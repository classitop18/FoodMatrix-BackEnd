import { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/app-error.utils.js";
import { sendResponse } from "@/utils/response.utils.js";
import { receiptService } from "./receipt.service.js";
import { receiptAIService } from "./receipt-ai.service.js";
import { PantryItemsService } from "../pantry/pantry.service.js";
import { PantryItemsStorage } from "../pantry/pantry.repository.js";

const pantryService = new PantryItemsService(new PantryItemsStorage());

export const uploadReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError("Receipt file is required", 400);
    }

    const { eventId, shoppingListId, description, tags } = req.body;
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }
    if (!accountId) {
      throw new AppError("Account ID is required", 401);
    }

    // Parse tags if sent as JSON string
    let parsedTags: string[] | undefined;
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = undefined;
      }
    }

    const receipt = await receiptService.processReceipt(
      req.file,
      userId,
      accountId,
      eventId,
      shoppingListId,
      description,
      parsedTags,
    );

    return sendResponse(res, receipt, "Receipt processed successfully", 201);
  } catch (error) {
    next(error);
  }
};

export const getReceipts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { page, limit, search, dateFrom, dateTo, sortBy, sortOrder } =
      req.query as Record<string, string>;

    const result = await receiptService.getReceipts(accountId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      dateFrom,
      dateTo,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    return sendResponse(res, result, "Receipts fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const getReceiptById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { id } = req.params;
    const receipt = await receiptService.getReceiptById(id, accountId);

    if (!receipt) {
      throw new AppError("Receipt not found", 404);
    }

    return sendResponse(res, receipt, "Receipt fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const updateReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { id } = req.params;
    const { description, tags, eventId, shoppingListId } = req.body;

    const updated = await receiptService.updateReceipt(id, accountId, {
      description,
      tags,
      eventId,
      shoppingListId,
    });

    return sendResponse(res, updated, "Receipt updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Add receipt items to pantry
 * Accepts verified items from the frontend and creates pantry entries
 */
export const addReceiptItemsToPantry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError("Items array is required and must not be empty", 400);
    }

    // Verify receipt exists and belongs to user
    const receipt = await receiptService.getReceiptById(id, accountId);
    if (!receipt) {
      throw new AppError("Receipt not found", 404);
    }

    // Get memberId for addedBy field
    const addedBy =
      (req as any).session?.memberId || (req as any).user?.memberId || null;

    // Add each item to pantry
    const addedItems = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const pantryItem = await pantryService.addPantryItem({
          ingredientName: item.name,
          category: item.category || "other",
          quantity: item.quantity || 1,
          unit: item.unit || "pcs",
          location: item.location || "pantry",
          expirationDate: item.expirationDate
            ? new Date(item.expirationDate)
            : null,
          costPaid: item.price || undefined,
          accountId,
          addedBy,
        });
        addedItems.push(pantryItem);
      } catch (err: any) {
        errors.push(`Failed to add "${item.name}": ${err.message}`);
      }
    }

    // Mark receipt as added to pantry
    if (addedItems.length > 0) {
      await receiptService.markAddedToPantry(id, accountId);
    }

    return sendResponse(
      res,
      {
        addedCount: addedItems.length,
        totalItems: items.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      `${addedItems.length} of ${items.length} items added to pantry`,
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get AI-suggested expiry dates for receipt items
 */
export const getExpirySuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { id } = req.params;
    const receipt = await receiptService.getReceiptById(id, accountId);

    if (!receipt) {
      throw new AppError("Receipt not found", 404);
    }

    const aiItems = Array.isArray(receipt.aiAuditedItems)
      ? (receipt.aiAuditedItems as any[])
      : [];

    if (aiItems.length === 0) {
      throw new AppError("No AI-audited items found for this receipt", 400);
    }

    const suggestions = await receiptAIService.suggestExpiryDates(aiItems);

    return sendResponse(
      res,
      suggestions,
      "Expiry suggestions fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a receipt
 */
export const deleteReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;
    if (!userId) throw new AppError("User not authenticated", 401);
    if (!accountId) throw new AppError("Account ID is required", 401);

    const { id } = req.params;

    // First ensure receipt exists and belongs to user
    const receipt = await receiptService.getReceiptById(id, accountId);
    if (!receipt) {
      throw new AppError("Receipt not found", 404);
    }

    await receiptService.deleteReceipt(id, accountId);

    return sendResponse(res, { id }, "Receipt deleted successfully");
  } catch (error) {
    next(error);
  }
};
