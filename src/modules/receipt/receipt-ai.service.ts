import { OpenAIProvider } from "../ai/providers/openai.provider.js";
import { logger } from "@/utils/logger.utils.js";

export interface AuditedReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  category:
    | "food"
    | "snacks"
    | "beverages"
    | "dairy"
    | "produce"
    | "meat"
    | "bakery"
    | "spices"
    | "frozen"
    | "household"
    | "other";
  brand?: string;
  confidence: number;
}

export interface AIReceiptAuditResult {
  storeName: string;
  storeAddress?: string;
  purchaseDate: string | null; // ISO date string
  currency: string;
  items: AuditedReceiptItem[];
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  paymentMethod?: string;
}

const RECEIPT_AUDIT_SYSTEM_PROMPT = `You are an expert receipt data extraction and auditing AI. Your job is to take raw OCR text extracted from grocery/store receipts and produce perfectly structured, accurate data.

**Your Expertise:**
- Correcting OCR errors (misread characters, broken words, garbled text)
- Identifying item names, quantities, units, and prices from messy receipt formats
- Categorizing grocery/store items accurately
- Detecting store name, date, tax, total, and payment information
- Understanding US and international receipt formats
- Handling multiple languages and transliterations

**Critical Rules:**
1. ALWAYS return valid JSON — no markdown, no code blocks, no extra text
2. Fix OCR errors intelligently (e.g., "C0CA C0LA" → "Coca Cola", "BRDAD" → "Bread")
3. Every item MUST have: name, quantity, unit, price, category, confidence
4. If quantity is not specified, default to 1
5. If unit is not clear, use "pcs" (pieces) for countable items, "kg" for weight items, "L" for liquids
6. Price must be the per-line total (quantity × unit price), NOT per-unit price
7. Category must be exactly one of: food, snacks, beverages, dairy, produce, meat, bakery, spices, frozen, household, other
8. Confidence is 0.0 to 1.0 — use lower values for items where OCR was unclear
9. The sum of all item prices should approximately equal subtotal (before tax)
10. Do NOT include tax lines, total lines, or discount lines as items
11. If a line looks like a discount (negative price or "DISC"/"OFF"), reduce the corresponding item's price
12. Store name is usually the first 1-3 lines of the receipt
13. Date formats vary — always return in ISO format (YYYY-MM-DD) or null if not found
14. Currency: detect from symbols ($=USD, ₹=INR, €=EUR) or default to USD for US receipts
15. If an item name contains a brand, extract it into the brand field
16. NEVER fabricate items that are not in the receipt text
17. NEVER guess prices — if price is unclear, set confidence to 0.3 and use best estimate

**Category Guide:**
- food: cooked meals, ready-to-eat items, rice, dal, flour, atta, oil, ghee, noodles, pasta
- snacks: chips, biscuits, cookies, namkeen, crackers, popcorn, chocolates, candy
- beverages: water, juice, soda, tea, coffee, milk drinks, energy drinks, alcohol
- dairy: milk, curd, yogurt, cheese, paneer, butter, cream
- produce: fruits, vegetables, fresh herbs
- meat: chicken, mutton, fish, eggs, seafood
- bakery: bread, buns, cakes, pastries, pav
- spices: masala, turmeric, chili powder, cumin, coriander, salt, pepper
- frozen: frozen vegetables, frozen meals, ice cream
- household: soap, detergent, tissue, foil, bags, cleaning supplies, toiletries
- other: anything that doesn't fit above categories`;

const buildUserPrompt = (rawText: string): string => {
  return `Analyze this raw OCR text extracted from a receipt and return structured data.

RAW RECEIPT TEXT:
---
${rawText}
---

Return a single JSON object with this EXACT structure (no additional keys, no markdown):
{
  "storeName": "string — name of the store",
  "storeAddress": "string or null — store address if found",
  "purchaseDate": "string (YYYY-MM-DD) or null",
  "currency": "INR or USD or EUR etc.",
  "items": [
    {
      "name": "string — clean, corrected item name",
      "quantity": 1,
      "unit": "pcs|kg|g|L|ml|pack|dozen|box|bottle|can|bag",
      "price": 0.00,
      "category": "food|snacks|beverages|dairy|produce|meat|bakery|spices|frozen|household|other",
      "brand": "string or null",
      "confidence": 0.95
    }
  ],
  "subtotal": 0.00,
  "taxAmount": 0.00,
  "totalAmount": 0.00,
  "paymentMethod": "string or null — cash, card, UPI, etc."
}

IMPORTANT VALIDATION:
- Sum of all item prices should roughly equal subtotal or totalAmount minus tax
- Do not include tax, subtotal, or total as items
- If you see quantity indicators like "2x" or "x3", multiply accordingly
- Remove any promotional text, barcodes, or reference numbers from item names`;
};

export class ReceiptAIService {
  private aiProvider: OpenAIProvider;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing OPENAI_API_KEY environment variable for receipt AI processing",
      );
    }
    this.aiProvider = new OpenAIProvider(apiKey);
  }

  /**
   * Takes raw OCR text and returns AI-audited, structured receipt data
   */
  async auditAndStructure(rawText: string): Promise<AIReceiptAuditResult> {
    logger.info("Starting AI receipt audit...");

    try {
      const response = await this.aiProvider.createCompletion({
        prompt: buildUserPrompt(rawText),
        systemPrompt: RECEIPT_AUDIT_SYSTEM_PROMPT,
        maxTokens: 4000,
        temperature: 0, // Deterministic output for accuracy
      });

      const content = response.content.trim();

      // Strip any markdown code fences if present
      const jsonStr = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsed: AIReceiptAuditResult;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (_parseError) {
        logger.error("Failed to parse AI response as JSON:", {
          response: content.substring(0, 500),
        });
        throw new Error("AI returned invalid JSON. Receipt processing failed.");
      }

      // Validate and sanitize the result
      parsed = this.validateAndSanitize(parsed);

      logger.info(
        `AI receipt audit complete: ${parsed.items.length} items extracted`,
      );
      return parsed;
    } catch (error: any) {
      logger.error("AI receipt audit failed:", error);
      throw new Error(`Receipt AI audit failed: ${error.message}`);
    }
  }

  /**
   * Get AI-suggested expiry dates for items to be added to pantry
   */
  async suggestExpiryDates(items: AuditedReceiptItem[]): Promise<
    Array<{
      name: string;
      suggestedExpiryDays: number;
      storageLocation: string;
    }>
  > {
    const itemNames = items.map((i) => `${i.name} (${i.category})`).join(", ");

    try {
      const response = await this.aiProvider.createCompletion({
        prompt: `For each of these grocery items, suggest the typical shelf life in days and best storage location.

Items: ${itemNames}

Return a JSON array with this structure (no markdown, no extra text):
[
  {
    "name": "exact item name as provided",
    "suggestedExpiryDays": 7,
    "storageLocation": "refrigerator|freezer|pantry|cabinet|countertop"
  }
]

Rules:
- Be realistic about shelf life (e.g., fresh milk=5-7 days, bread=5 days, rice=365 days, chips=90 days)
- Consider typical US storage conditions
- Storage locations: refrigerator (perishables), freezer (frozen/meat), pantry (dry goods/grains), cabinet (canned/packaged), countertop (fruits/onions/potatoes)`,
        systemPrompt:
          "You are a food storage and preservation expert. Return pure JSON only, no markdown.",
        maxTokens: 2000,
        temperature: 0,
      });

      const content = response.content.trim();
      const jsonStr = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      return JSON.parse(jsonStr);
    } catch (_error) {
      logger.warn("Failed to get AI expiry suggestions, using defaults");
      // Return sensible defaults
      return items.map((item) => ({
        name: item.name,
        suggestedExpiryDays: this.getDefaultExpiryDays(item.category),
        storageLocation: this.getDefaultStorage(item.category),
      }));
    }
  }

  private validateAndSanitize(
    data: AIReceiptAuditResult,
  ): AIReceiptAuditResult {
    const validCategories = [
      "food",
      "snacks",
      "beverages",
      "dairy",
      "produce",
      "meat",
      "bakery",
      "spices",
      "frozen",
      "household",
      "other",
    ];

    // Ensure items is an array
    if (!Array.isArray(data.items)) {
      data.items = [];
    }

    // Sanitize each item
    data.items = data.items
      .filter((item) => item && item.name && typeof item.name === "string")
      .map((item) => ({
        name: String(item.name).trim(),
        quantity:
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : 1,
        unit: String(item.unit || "pcs").trim(),
        price:
          typeof item.price === "number" && item.price >= 0 ? item.price : 0,
        category: validCategories.includes(item.category)
          ? item.category
          : "other",
        brand: item.brand ? String(item.brand).trim() : undefined,
        confidence:
          typeof item.confidence === "number"
            ? Math.min(1, Math.max(0, item.confidence))
            : 0.5,
      }));

    // Sanitize top-level fields
    data.storeName = data.storeName || "Unknown Store";
    data.currency = data.currency || "USD";
    data.totalAmount =
      typeof data.totalAmount === "number" ? data.totalAmount : null;
    data.taxAmount = typeof data.taxAmount === "number" ? data.taxAmount : null;
    data.subtotal = typeof data.subtotal === "number" ? data.subtotal : null;

    return data;
  }

  private getDefaultExpiryDays(category: string): number {
    const defaults: Record<string, number> = {
      produce: 5,
      dairy: 7,
      meat: 3,
      bakery: 5,
      frozen: 90,
      beverages: 180,
      snacks: 90,
      food: 30,
      spices: 365,
      household: 730,
      other: 30,
    };
    return defaults[category] || 30;
  }

  private getDefaultStorage(category: string): string {
    const defaults: Record<string, string> = {
      produce: "refrigerator",
      dairy: "refrigerator",
      meat: "freezer",
      bakery: "countertop",
      frozen: "freezer",
      beverages: "pantry",
      snacks: "pantry",
      food: "pantry",
      spices: "cabinet",
      household: "cabinet",
      other: "pantry",
    };
    return defaults[category] || "pantry";
  }
}

export const receiptAIService = new ReceiptAIService();
