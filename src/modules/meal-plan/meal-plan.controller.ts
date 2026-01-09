import type { NextFunction, Response } from "express";
import { MealPlanService } from "./meal-plan.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";
import {
  createMealPlanSchema,
  getMealPlansQuerySchema,
  mealPlanIdParamSchema,
  updateMealPlanSchema,
} from "./dto/meal-plan.dto.js";

interface SessionRequest {
  session?: {
    accountId?: string;
    memberId?: string;
  };
}

export class MealPlanController {
  private service: MealPlanService;

  constructor(service: MealPlanService) {
    this.service = service;
  }

  private getAccountId(req: AuthenticatedRequest): string {
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as unknown as SessionRequest).session?.accountId;

    if (!accountId) {
      return "";
    }
    return accountId;
  }

  // ============ GET MEAL PLANS ============
  getMealPlans = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = getMealPlansQuerySchema.parse(req.query);
      const accountId = this.getAccountId(req);

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const result = await this.service.getMealPlans(accountId, validatedQuery);

      return sendResponse(res, result, "Meal plans fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  // ============ CREATE MEAL PLAN ============
  createMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = createMealPlanSchema.parse(req.body);
      const accountId = this.getAccountId(req);

      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const createdBy =
        (req as unknown as SessionRequest).session?.memberId ||
        (req.user as any)?.memberId;

      if (!createdBy) {
        throw new AppError("Member ID (created_by) is required", 400);
      }

      const item = await this.service.createMealPlan({
        ...validatedData,
        accountId,
        createdBy,
      });

      return sendResponse(res, item, "Meal plan created successfully", 201);
    } catch (error) {
      // console.error(error)
      next(error);
    }
  };

  // ============ UPDATE MEAL PLAN ============
  updateMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = mealPlanIdParamSchema.parse(req.params);
      const validatedData = updateMealPlanSchema.parse(req.body);

      const updated = await this.service.updateMealPlan(
        validatedParams.id,
        validatedData,
      );

      return sendResponse(res, updated, "Meal plan updated successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  // ============ DELETE MEAL PLAN ============
  deleteMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = mealPlanIdParamSchema.parse(req.params);
      await this.service.deleteMealPlan(validatedParams.id);

      return sendResponse(res, null, "Meal plan deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  };
}
