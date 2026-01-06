import type { NextFunction, Response } from "express";
import { PantryItemsService } from "./pantry.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";
import {
  updatePantryItemSchema,
  getPantryItemsQuerySchema,
  pantryItemIdParamSchema,
  getExpiringItemsQuerySchema,
  alertIdParamSchema,
} from "./dto/pantry.dto.js";

interface SessionRequest {
  session?: {
    accountId?: string;
    memberId?: string;
  };
}

export class PantryItemsController {
  private service: PantryItemsService;

  constructor(service: PantryItemsService) {
    this.service = service;
  }

  private getAccountId(req: AuthenticatedRequest): string {
    // Try to get from headers (sent by frontend) or session (if set by some middleware)
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as unknown as SessionRequest).session?.accountId;
    if (!accountId) {
      // throw new Error("Account ID is required");
      // We can't throw here easily to return 400 without custom error class.
      // So we return null and handle in caller or use a custom error type.
      // For simplicity, let's return null and check in caller.
      return "";
    }
    return accountId;
  }

  // ============ GET PANTRY ITEMS ============
  getPantryItems = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = getPantryItemsQuerySchema.parse(req.query);
      const accountId = this.getAccountId(req);

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const result = await this.service.getPantryItems(
        accountId,
        validatedQuery,
      );

      return sendResponse(
        res,
        result,
        "Pantry items fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ GET EXPIRING ITEMS ============
  getExpiringItems = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = getExpiringItemsQuerySchema.parse(req.query);
      const accountId = this.getAccountId(req);

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const result = await this.service.getExpiringItems(
        accountId,
        validatedQuery.days,
      );

      return sendResponse(
        res,
        result,
        "Expiring items fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ GET PANTRY ALERTS ============
  getPantryAlerts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const result = await this.service.getPantryAlerts(accountId);

      return sendResponse(
        res,
        result,
        "Pantry alerts fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ DISMISS ALERT ============
  dismissAlert = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = alertIdParamSchema.parse(req.params);
      await this.service.dismissAlert(validatedParams.id);

      return sendResponse(res, null, "Alert dismissed successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  // ============ ADD PANTRY ITEM ============
  addPantryItem = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = req.body;
      const accountId = this.getAccountId(req);

      // console.log({ validatedData, accountId });

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }
      // Try to find a valid member ID from session or user object attached by auth middleware
      // Note: 'addedBy' references 'members.id', NOT 'users.id'.
      // If the user logging in does not have a member ID in the session (e.g. they are just a user but haven't selected a member profile or auth middleware doesn't attach it),
      // we should probably pass NULL or try to look it up if critical.
      // For now, if we can't find a memberId, we pass null to avoid FK violation with users.id
      const addedBy =
         
        (req as unknown as SessionRequest).session?.memberId ||
        (req.user as any)?.memberId ||
        null;
      const item = await this.service.addPantryItem({
        ...validatedData,
        accountId,
        addedBy,
      });

      return sendResponse(res, item, "Pantry item added successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  // ============ UPDATE PANTRY ITEM ============
  updatePantryItem = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = pantryItemIdParamSchema.parse(req.params);
      const validatedData = updatePantryItemSchema.parse(req.body);

      const updated = await this.service.updatePantryItem(
        validatedParams.id,
        validatedData,
      );

      return sendResponse(
        res,
        updated,
        "Pantry item updated successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ DELETE PANTRY ITEM ============
  deletePantryItem = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = pantryItemIdParamSchema.parse(req.params);
      await this.service.deletePantryItem(validatedParams.id);

      return sendResponse(res, null, "Pantry item deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  };
}
