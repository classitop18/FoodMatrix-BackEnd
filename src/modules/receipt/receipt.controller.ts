import { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/app-error.utils.js";
import { sendResponse } from "@/utils/response.utils.js";
import { receiptService } from "./receipt.service.js";

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

    if (!userId) {
      throw new AppError("User not authenticated", 401);
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
    if (!userId) throw new AppError("User not authenticated", 401);

    const { page, limit, search, dateFrom, dateTo, sortBy, sortOrder } =
      req.query as Record<string, string>;

    const result = await receiptService.getReceipts(userId, {
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
    if (!userId) throw new AppError("User not authenticated", 401);

    const { id } = req.params;
    const receipt = await receiptService.getReceiptById(id, userId);

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
    if (!userId) throw new AppError("User not authenticated", 401);

    const { id } = req.params;
    const { description, tags, eventId, shoppingListId } = req.body;

    const updated = await receiptService.updateReceipt(id, userId, {
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
