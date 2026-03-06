import { authenticate } from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validation.middleware.js";
import { BudgetController } from "@/modules/budget/budget.controller.js";
import { BudgetService } from "@/modules/budget/budget.service.js";
import {
  budgetAccountIdParamSchema,
  setDailyBudgetSchema,
  updateBudgetSchema,
  logExpenseSchema,
  budgetHistoryQuerySchema,
  analyticsQuerySchema,
} from "@/modules/budget/dto/budget.dto.js";
import { Router } from "express";

const router = Router();

/* ---------------- INIT DEPENDENCIES ---------------- */

const budgetService = new BudgetService();
const budgetController = new BudgetController(budgetService);

/* ---------------- ROUTES ---------------- */

/**
 * Set daily budget for a specific date (calendar-based)
 */
router.post(
  "/:accountId/set-daily",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  validate(setDailyBudgetSchema, "body"),
  budgetController.setDailyBudget,
);

/**
 * Update budget config
 */
router.put(
  "/:accountId/config",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  validate(updateBudgetSchema, "body"),
  budgetController.updateBudget,
);

/**
 * Log daily expense
 */
router.post(
  "/:accountId/expense",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  validate(logExpenseSchema, "body"),
  budgetController.logExpense,
);

/**
 * Get today's budget summary (with fallback)
 */
router.get(
  "/:accountId/today",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  budgetController.getTodayBudget,
);

/**
 * Get weekly summary (Sun–Sat breakdown)
 */
router.get(
  "/:accountId/weekly",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  budgetController.getWeeklySummary,
);

/**
 * Get budget history
 */
router.get(
  "/:accountId/history",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  validate(budgetHistoryQuerySchema, "query"),
  budgetController.getBudgetHistory,
);

/**
 * Get analytics data
 */
router.get(
  "/:accountId/analytics",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  validate(analyticsQuerySchema, "query"),
  budgetController.getAnalytics,
);

/**
 * Get pending expense updates
 */
router.get(
  "/:accountId/pending",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  budgetController.getPendingUpdates,
);

/**
 * Get budget config version history
 */
router.get(
  "/:accountId/versions",
  authenticate,
  validate(budgetAccountIdParamSchema, "params"),
  budgetController.getConfigVersions,
);

export default router;
