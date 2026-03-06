import { Response, NextFunction } from "express";
import { BudgetService } from "./budget.service.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";

export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  /* ---------------- SET DAILY BUDGET (Calendar-based) ---------------- */

  setDailyBudget = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;
      const { date, amount } = req.body;

      const result = await this.budgetService.setDailyBudget({
        date,
        amount,
        accountId,
        userId,
      });

      return sendResponse(res, result, "Budget set successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- UPDATE BUDGET CONFIG ---------------- */

  updateBudget = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;
      const body = req.body;

      const config = await this.budgetService.updateBudget({
        ...body,
        accountId,
        userId,
      });

      return sendResponse(res, config, "Budget updated successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- LOG EXPENSE ---------------- */

  logExpense = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;
      const body = req.body;

      const result = await this.budgetService.logExpense({
        ...body,
        accountId,
        userId,
      });

      return sendResponse(res, result, "Expense logged successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET TODAY'S BUDGET ---------------- */

  getTodayBudget = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const summary = await this.budgetService.getTodayBudget(accountId);
      return sendResponse(res, summary, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET WEEKLY SUMMARY ---------------- */

  getWeeklySummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const summary = await this.budgetService.getWeeklySummary(accountId);
      return sendResponse(res, summary, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET BUDGET HISTORY ---------------- */

  getBudgetHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const query = req.query;
      const history = await this.budgetService.getBudgetHistory(
        accountId,
        query as any,
      );
      return sendResponse(res, history, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET ANALYTICS ---------------- */

  getAnalytics = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const { period } = req.query as { period: "weekly" | "monthly" };
      const analytics = await this.budgetService.getAnalytics(
        accountId,
        period || "weekly",
      );
      return sendResponse(res, analytics, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET PENDING UPDATES ---------------- */

  getPendingUpdates = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const pending = await this.budgetService.getPendingUpdates(accountId);
      return sendResponse(res, pending, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET CONFIG VERSIONS ---------------- */

  getConfigVersions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { accountId } = req.params;
      const versions = await this.budgetService.getConfigVersions(accountId);
      return sendResponse(res, versions, "Success", 200);
    } catch (error) {
      next(error);
    }
  };
}
