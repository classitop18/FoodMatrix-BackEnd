import { ImageAnnotatorClient } from "@google-cloud/vision";
import { getDb } from "@/database/db.js";
import { receipts } from "@/database/schemas/receipts.js";
import { users } from "@/database/schemas/schema.js";
import { logger } from "@/utils/logger.utils.js";
import { s3Service, S3Folder } from "../storage/s3.service.js";
import { eq, desc, and, ilike, gte, lte, sql } from "drizzle-orm";

// @ts-expect-error - No types available for pdf-parse
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Initialize Vision Client
const visionClient = new ImageAnnotatorClient();

interface ExtractedItem {
  name: string;
  quantity?: number;
  price?: number;
}

interface ExtractedReceiptData {
  storeName?: string;
  totalAmount?: number;
  taxAmount?: number;
  purchaseDate?: Date;
  items: ExtractedItem[];
  rawText: string;
}

export interface ReceiptListParams {
  page?: number;
  limit?: number;
  search?: string; // Search by storeName or description
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "purchaseDate" | "totalAmount";
  sortOrder?: "asc" | "desc";
}

export class ReceiptService {
  /**
   * Process an uploaded receipt file (image or PDF)
   */
  async processReceipt(
    file: Express.Multer.File,
    userId: string,
    accountId: string,
    eventId?: string,
    shoppingListId?: string,
    description?: string,
    tags?: string[],
  ) {
    try {
      logger.info(`Processing receipt for user ${userId}`);
      let extractedData: ExtractedReceiptData;

      if (file.mimetype === "application/pdf") {
        extractedData = await this.extractFromPdf(file.buffer);
      } else {
        extractedData = await this.extractFromImage(file.buffer);
      }

      // Upload receipt image/PDF to S3
      let imageUrl: string | null = null;
      if (s3Service.isConfigured()) {
        try {
          imageUrl = await s3Service.uploadFile(
            file.buffer,
            S3Folder.RECEIPTS,
            file.originalname,
            file.mimetype,
            userId,
          );
          logger.info(`Receipt image uploaded to S3: ${imageUrl}`);
        } catch (uploadError) {
          logger.warn(
            "Failed to upload receipt image to S3, continuing without image URL:",
            uploadError,
          );
        }
      }

      // Save to Database
      const db = getDb();
      const [newReceipt] = await db
        .insert(receipts)
        .values({
          userId,
          accountId,
          eventId,
          shoppingListId,
          storeName: extractedData.storeName,
          totalAmount: extractedData.totalAmount
            ? extractedData.totalAmount.toString()
            : null,
          taxAmount: extractedData.taxAmount
            ? extractedData.taxAmount.toString()
            : null,
          purchaseDate: extractedData.purchaseDate,
          items: extractedData.items,
          rawText: extractedData.rawText,
          imageUrl,
          description: description || null,
          tags: tags ?? [],
        })
        .returning();

      logger.info(`Receipt processed and saved with ID: ${newReceipt.id}`);
      return newReceipt;
    } catch (error) {
      logger.error("Error processing receipt:", error);
      throw error;
    }
  }

  /**
   * Get paginated list of receipts for a user
   */
  async getReceipts(accountId: string, params: ReceiptListParams = {}) {
    const db = getDb();
    const {
      page = 1,
      limit = 10,
      search,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: any[] = [eq(receipts.accountId, accountId)];

    if (search) {
      conditions.push(
        sql`(${ilike(receipts.storeName, `%${search}%`)} OR ${ilike(receipts.description, `%${search}%`)})`,
      );
    }

    if (dateFrom) {
      conditions.push(gte(receipts.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(receipts.createdAt, toDate));
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    // Build ORDER BY
    const orderColumn = receipts[sortBy as keyof typeof receipts] as any;
    const orderClause = sortOrder === "asc" ? orderColumn : desc(orderColumn);

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: receipts.id,
          userId: receipts.userId,
          accountId: receipts.accountId,
          eventId: receipts.eventId,
          shoppingListId: receipts.shoppingListId,
          storeName: receipts.storeName,
          totalAmount: receipts.totalAmount,
          taxAmount: receipts.taxAmount,
          purchaseDate: receipts.purchaseDate,
          items: receipts.items,
          imageUrl: receipts.imageUrl,
          rawText: receipts.rawText,
          description: receipts.description,
          tags: receipts.tags,
          createdAt: receipts.createdAt,
          updatedAt: receipts.updatedAt,
          submittedBy: {
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.avatar,
          },
        })
        .from(receipts)
        .leftJoin(users, eq(receipts.userId, users.id))
        .where(whereClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(receipts)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a single receipt by ID (must belong to user)
   */
  async getReceiptById(id: string, accountId: string) {
    const db = getDb();
    const [receipt] = await db
      .select({
        id: receipts.id,
        userId: receipts.userId,
        accountId: receipts.accountId,
        eventId: receipts.eventId,
        shoppingListId: receipts.shoppingListId,
        storeName: receipts.storeName,
        totalAmount: receipts.totalAmount,
        taxAmount: receipts.taxAmount,
        purchaseDate: receipts.purchaseDate,
        items: receipts.items,
        imageUrl: receipts.imageUrl,
        rawText: receipts.rawText,
        description: receipts.description,
        tags: receipts.tags,
        createdAt: receipts.createdAt,
        updatedAt: receipts.updatedAt,
        submittedBy: {
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
        },
      })
      .from(receipts)
      .leftJoin(users, eq(receipts.userId, users.id))
      .where(and(eq(receipts.id, id), eq(receipts.accountId, accountId)));

    return receipt ?? null;
  }

  /**
   * Update receipt annotation (description, tags, eventId, shoppingListId)
   */
  async updateReceipt(
    id: string,
    accountId: string,
    data: {
      description?: string | null;
      tags?: string[];
      eventId?: string | null;
      shoppingListId?: string | null;
    },
  ) {
    const db = getDb();

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.eventId !== undefined) updateData.eventId = data.eventId;
    if (data.shoppingListId !== undefined)
      updateData.shoppingListId = data.shoppingListId;

    const [updated] = await db
      .update(receipts)
      .set(updateData)
      .where(and(eq(receipts.id, id), eq(receipts.accountId, accountId)))
      .returning();

    if (!updated) {
      throw new Error("Receipt not found or unauthorized");
    }

    return updated;
  }

  /**
   * Extract text from an image buffer using Google Cloud Vision
   */
  async extractFromImage(buffer: Buffer): Promise<ExtractedReceiptData> {
    const [result] = await visionClient.textDetection(buffer);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error("No text detected in the image");
    }

    // The first annotation contains the entire text
    const fullText = detections[0].description || "";
    return this.parseReceiptText(fullText);
  }

  async extractFromPdf(buffer: Buffer): Promise<ExtractedReceiptData> {
    logger.info("PDF OCR request received - extracting text via pdf-parse");
    try {
      const data = await pdfParse(buffer);
      if (!data.text || data.text.trim().length === 0) {
        throw new Error(
          "No text found in PDF. If this is a scanned receipt, please upload it as an image (JPG/PNG).",
        );
      }
      return this.parseReceiptText(data.text);
    } catch (error: any) {
      if (error.message && error.message.includes("No text found")) {
        throw error;
      }
      logger.error("Failed to parse PDF receipt:", error);
      throw new Error(
        "Failed to parse PDF. Please ensure it is a valid digital receipt or upload an image (JPG/PNG) instead.",
      );
    }
  }

  /**
   * Parse raw text into structured data
   */
  parseReceiptText(text: string): ExtractedReceiptData {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. Store Name (Heuristic: usually the first valid line that isn't a header)
    const storeName = lines[0] || "Unknown Store";

    // 2. Date — always validate to avoid RangeError when JS can't parse the matched string
    const dateRegex =
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
    const dateMatch = text.match(dateRegex);
    const parsedDate = dateMatch ? new Date(dateMatch[0]) : null;
    const purchaseDate =
      parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

    // 3. Prices and Items
    const items: ExtractedItem[] = [];
    let totalAmount: number | undefined;
    let taxAmount: number | undefined;

    // Common price regex (e.g., 12.99, $12.99)
    const priceRegex = /(-?\$?\s?\d+\.\d{2})/;

    // Iterate lines to find items and total
    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // Check for Total
      if (
        lowerLine.match(/^total\s*:?/i) ||
        lowerLine.match(/^amount due\s*:?/i) ||
        lowerLine.match(/^grand total\s*:?/i)
      ) {
        const match = line.match(priceRegex);
        if (match) {
          const val = parseFloat(match[0].replace(/[^0-9.-]+/g, ""));
          if (!totalAmount || val > totalAmount) {
            totalAmount = val;
          }
        }
        continue;
      }

      // Check for Tax
      if (lowerLine.includes("tax") && !lowerLine.includes("total")) {
        const match = line.match(priceRegex);
        if (match) {
          taxAmount = parseFloat(match[0].replace(/[^0-9.-]+/g, ""));
        }
        continue;
      }

      // Check for Items (heuristic: line ends with a price)
      const priceMatch = line.match(/(\d+\.\d{2})$/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        let name = line.substring(0, line.lastIndexOf(priceMatch[1])).trim();
        name = name.replace(/[.$]+$/, "").trim();

        if (name.length > 2 && !name.toLowerCase().includes("subtotal")) {
          items.push({ name, price, quantity: 1 });
        }
      }
    }

    return {
      storeName,
      totalAmount,
      taxAmount,
      purchaseDate,
      items,
      rawText: text,
    };
  }
}

export const receiptService = new ReceiptService();
