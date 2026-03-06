import { ImageAnnotatorClient } from "@google-cloud/vision";
import { getDb } from "@/database/db.js";
import { receipts } from "@/database/schemas/receipts.js";
import { users } from "@/database/schemas/schema.js";
import { logger } from "@/utils/logger.utils.js";
import { s3Service, S3Folder } from "../storage/s3.service.js";
import { eq, desc, and, ilike, gte, lte, sql } from "drizzle-orm";
import { gcsService } from "../../utils/gcs.utils.js";
import { randomUUID } from "crypto";
import PDFParser from "pdf2json";
import { PDFParse } from "pdf-parse";

import {
  receiptAIService,
  type AIReceiptAuditResult,
} from "./receipt-ai.service.js";

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
   * Flow: Upload → OCR → AI Audit → Store
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

      // Step 1: Extract raw text via Google Vision
      let rawText: string;
      if (file.mimetype === "application/pdf") {
        rawText = await this.extractTextFromPdf(file.buffer);
      } else {
        rawText = await this.extractTextFromImage(file.buffer);
      }
      console.log(rawText, "rawtext");

      // Step 2: Upload receipt image/PDF to S3
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

      // Step 3: AI Audit — structure and categorize the extracted text
      let aiResult: AIReceiptAuditResult | null = null;
      let aiProcessingStatus = "processing";
      try {
        aiResult = await receiptAIService.auditAndStructure(rawText);
        aiProcessingStatus = "completed";
        logger.info(
          `AI audit completed: ${aiResult.items.length} items, total: ${aiResult.totalAmount}`,
        );
      } catch (aiError) {
        logger.error("AI audit failed, falling back to raw parsing:", aiError);
        aiProcessingStatus = "failed";
      }

      // Step 4: Parse raw text for fallback items (regex-based)
      const rawParsed = this.parseReceiptText(rawText);

      // Use AI results for store name, amounts, and date if available
      const storeName = aiResult?.storeName || rawParsed.storeName;
      const totalAmount = aiResult?.totalAmount ?? rawParsed.totalAmount;
      const taxAmount = aiResult?.taxAmount ?? rawParsed.taxAmount;
      const purchaseDate = aiResult?.purchaseDate
        ? new Date(aiResult.purchaseDate)
        : rawParsed.purchaseDate;
      const currency = aiResult?.currency || "USD";

      // Step 5: Save to Database
      const db = getDb();
      const [newReceipt] = await db
        .insert(receipts)
        .values({
          userId,
          accountId,
          eventId,
          shoppingListId,
          storeName,
          totalAmount: totalAmount ? totalAmount.toString() : null,
          taxAmount: taxAmount ? taxAmount.toString() : null,
          purchaseDate:
            purchaseDate && !isNaN(purchaseDate.getTime())
              ? purchaseDate
              : new Date(),
          items: rawParsed.items, // Raw regex-parsed items
          aiAuditedItems: aiResult?.items || [], // AI-structured items
          aiProcessingStatus,
          currency,
          imageUrl,
          rawText,
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
    const validSortCols = ["createdAt", "purchaseDate", "totalAmount"];
    const sortField = validSortCols.includes(sortBy) ? sortBy : "createdAt";
    const orderColumn = receipts[sortField as keyof typeof receipts] as any;
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
          aiAuditedItems: receipts.aiAuditedItems,
          aiProcessingStatus: receipts.aiProcessingStatus,
          currency: receipts.currency,
          addedToPantry: receipts.addedToPantry,
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
        aiAuditedItems: receipts.aiAuditedItems,
        aiProcessingStatus: receipts.aiProcessingStatus,
        currency: receipts.currency,
        addedToPantry: receipts.addedToPantry,
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
   * Delete a single receipt by ID
   */
  async deleteReceipt(id: string, accountId: string) {
    const db = getDb();
    const [deleted] = await db
      .delete(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.accountId, accountId)))
      .returning({ id: receipts.id });

    return deleted ?? null;
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
   * Mark receipt as added to pantry
   */
  async markAddedToPantry(id: string, accountId: string) {
    const db = getDb();
    const [updated] = await db
      .update(receipts)
      .set({ addedToPantry: true, updatedAt: new Date() })
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
  async extractTextFromImage(buffer: Buffer): Promise<string> {
    const [result] = await visionClient.textDetection(buffer);

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error("No text detected in the image");
    }

    return detections[0].description || "";
  }

  /**
   * Extract text from a PDF buffer using Google Cloud Vision (asyncBatchAnnotateFiles via GCS)
   */

  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    logger.info("PDF OCR request received - extracting text from PDF");

    // Try GCS + Vision API first (handles scanned PDFs)
    // if (gcsService.isConfigured()) {
    //   try {
    //     return await this.extractTextFromPdfViaVision(buffer);
    //   } catch (visionError: any) {
    //     logger.warn(
    //       "Vision API PDF processing failed, falling back to pdf-parse:",
    //       visionError.message
    //     );
    //   }
    // }

    // Primary fallback: pdf2json
    let pdf2jsonError: any = null;
    try {
      logger.info("Trying pdf2json for digital PDF text extraction");

      const text = await new Promise<string>((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (errData: any) => {
          reject(errData.parserError);
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
          try {
            let extractedText = "";
            pdfData.Pages.forEach((page: any) => {
              page.Texts.forEach((textItem: any) => {
                textItem.R.forEach((r: any) => {
                  extractedText += decodeURIComponent(r.T) + " ";
                });
              });
              extractedText += "\n";
            });
            resolve(extractedText);
          } catch (err) {
            reject(err);
          }
        });

        pdfParser.parseBuffer(buffer);
      });

      if (!text || !text.trim()) {
        throw new Error("pdf2json returned empty text");
      }

      logger.info(`pdf2json extracted ${text.length} characters from PDF`);
      return text.trim();
    } catch (err: any) {
      pdf2jsonError = err;
      logger.warn(
        `pdf2json failed (${err.message}), trying pdf-parse fallback...`,
      );
    }

    // Secondary fallback: pdf-parse v2 (different pdfjs version — handles more PDF types)
    try {
      logger.info("Trying pdf-parse v2 as secondary fallback");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();

      if (!result.text || !result.text.trim()) {
        throw new Error(
          "No text found in PDF. This may be a scanned document — please upload an image instead, or configure Google Cloud Storage for PDF OCR.",
        );
      }

      logger.info(
        `pdf-parse extracted ${result.text.length} characters from PDF`,
      );
      await parser.destroy();
      return result.text.trim();
    } catch (parseError: any) {
      logger.error("pdf-parse fallback also failed:", parseError.message);
      logger.error("Original pdf2json error was:", pdf2jsonError?.message);
      throw new Error(
        "Failed to extract text from PDF. Please try uploading an image of the receipt instead.",
      );
    }
  }
  /**
   * Extract text from a PDF via Google Cloud Vision (asyncBatchAnnotateFiles via GCS)
   */
  private async extractTextFromPdfViaVision(buffer: Buffer): Promise<string> {
    const jobId = randomUUID();
    const gcsInputPath = `receipt-processing/in/${jobId}.pdf`;
    const gcsOutputPrefix = `receipt-processing/out/${jobId}/`;

    let inputUri = "";

    try {
      // 1. Upload PDF to GCS
      inputUri = await gcsService.uploadFile(
        buffer,
        gcsInputPath,
        "application/pdf",
      );
      const bucketName = gcsService.getBucketName();
      const outputUri = `gs://${bucketName}/${gcsOutputPrefix}`;

      // 2. Configure the async Vision API request
      const request = {
        requests: [
          {
            inputConfig: {
              gcsSource: { uri: inputUri },
              mimeType: "application/pdf",
            },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
            outputConfig: {
              gcsDestination: { uri: outputUri },
              batchSize: 10, // Pages per output JSON file
            },
          },
        ],
      };

      // 3. Start the async document text detection
      logger.info(`Starting async Vision API job for PDF: ${inputUri}`);
      const [operation] = await visionClient.asyncBatchAnnotateFiles(request);

      // 4. Wait for the operation to complete
      await operation.promise();
      logger.info(`Vision API job completed. Output prefix: ${outputUri}`);

      // 5. List and process all output JSON files from GCS
      const resultFiles = await gcsService.listFilesByPrefix(gcsOutputPrefix);

      if (resultFiles.length === 0) {
        throw new Error("Vision API completed but no output files were found.");
      }

      let fullRawText = "";

      // Download each JSON file, parse, and concatenate text
      for (const fileUri of resultFiles.sort()) {
        // Sort ensures pages are in order (e.g., output-1-to-10.json)
        if (!fileUri.endsWith(".json")) continue;

        const jsonData = await gcsService.downloadJson(fileUri);

        // Loop through all pages in this batch
        if (jsonData.responses) {
          for (const response of jsonData.responses) {
            if (
              response.fullTextAnnotation &&
              response.fullTextAnnotation.text
            ) {
              fullRawText += response.fullTextAnnotation.text + "\n\n";
            }
          }
        }
      }

      if (!fullRawText.trim()) {
        throw new Error(
          "No text found in PDF. If this is a scanned receipt, please ensure it is clear.",
        );
      }

      return fullRawText.trim();
    } catch (error: any) {
      logger.error("Failed to parse PDF receipt via Vision API:", error);
      throw new Error(
        "Failed to parse PDF via Vision API. " + (error.message || ""),
      );
    } finally {
      // 6. Cleanup input/output files from GCS
      if (gcsService.isConfigured()) {
        try {
          if (inputUri) {
            await gcsService.deleteFilesByPrefix(gcsInputPath);
          }
          await gcsService.deleteFilesByPrefix(gcsOutputPrefix);
        } catch (cleanupError) {
          logger.warn(
            `Failed to cleanup GCS files for job ${jobId}:`,
            cleanupError,
          );
        }
      }
    }
  }

  // Keep legacy method for fallback
  async extractFromImage(buffer: Buffer): Promise<ExtractedReceiptData> {
    const fullText = await this.extractTextFromImage(buffer);
    return this.parseReceiptText(fullText);
  }

  async extractFromPdf(buffer: Buffer): Promise<ExtractedReceiptData> {
    const fullText = await this.extractTextFromPdf(buffer);
    return this.parseReceiptText(fullText);
  }

  /**
   * Parse raw text into structured data (regex-based fallback)
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
