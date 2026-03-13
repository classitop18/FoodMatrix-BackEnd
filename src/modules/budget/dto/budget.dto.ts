import { z } from "zod";

// ================== PARAM SCHEMAS ==================

export const budgetAccountIdParamSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});

// ================== SET DAILY BUDGET (Calendar-based) ==================

export const setDailyBudgetSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Amount must be positive"),
});

// ================== UPDATE BUDGET CONFIG ==================

export const updateBudgetSchema = z
  .object({
    mode: z.enum(["daily", "weekly"]).optional(),
    dailyAmount: z
      .number()
      .positive("Daily amount must be positive")
      .optional(),
    weeklyAmount: z
      .number()
      .positive("Weekly amount must be positive")
      .optional(),
    changeReason: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      return (
        data.mode !== undefined ||
        data.dailyAmount !== undefined ||
        data.weeklyAmount !== undefined
      );
    },
    { message: "At least one field must be provided to update" },
  );

// ================== LOG EXPENSE ==================

export const logExpenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amountSpent: z.number().min(0, "Amount spent cannot be negative"),
  categoriesBreakdown: z.record(z.number().min(0)).optional(),
  notes: z.string().max(500).optional(),
});

// ================== QUERY SCHEMAS ==================

export const budgetHistoryQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(["weekly", "monthly", "yearly", "custom"]).default("weekly"),
  year: z.string().optional(),
  month: z.string().optional(),
  weekDate: z.string().optional(),
});
