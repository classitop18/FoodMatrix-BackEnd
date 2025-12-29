import type { NextFunction, Response } from "express";
import { MealPlanService } from "./meal-plan.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendSuccess } from "../../utils/response.utils.js";
import {
  createMealPlanSchema,
  getMealPlansQuerySchema,
  mealPlanIdParamSchema,
  updateMealPlanSchema,
} from "./dto/meal-plan.dto.js";

export class MealPlanController {
  private service: MealPlanService;

  constructor(service: MealPlanService) {
    this.service = service;
  }

  private getAccountId(req: AuthenticatedRequest): string {
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId;

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
        return res.status(400).json({ error: "Account ID is required" });
      }

      const result = await this.service.getMealPlans(accountId, validatedQuery);

      return sendSuccess(res, result, "Meal plans fetched successfully", 200);
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
        return res.status(400).json({ error: "Account ID is required" });
      }

      const createdBy =
        (req as any).session?.memberId || (req.user as any)?.memberId;

      if (!createdBy) {
        return res
          .status(400)
          .json({ error: "Member ID (created_by) is required" });
      }

      const item = await this.service.createMealPlan({
        ...validatedData,
        accountId,
        createdBy,
      });

      return sendSuccess(res, item, "Meal plan created successfully", 201);
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

      return sendSuccess(res, updated, "Meal plan updated successfully", 200);
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

      return sendSuccess(res, null, "Meal plan deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  };
}
