import { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/app-error.utils.js";
import { sendResponse } from "@/utils/response.utils.js";
import { receiptService } from "./receipt.service.js"; // Same directory, relative is fine

export const uploadReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError("Receipt file is required", 400);
    }

    const { eventId, shoppingListId } = req.body;
    // Assuming user ID is available in req.user (middleware populates it)
    // You might need to adjust this depending on how your auth middleware works.
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const receipt = await receiptService.processReceipt(
      req.file,
      userId,
      eventId,
      shoppingListId,
    );

    return sendResponse(res, receipt, "Receipt processed successfully", 201);
  } catch (error) {
    next(error);
  }
};
