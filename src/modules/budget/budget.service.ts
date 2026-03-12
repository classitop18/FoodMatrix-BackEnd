import { AppError } from "../../utils/app-error.utils.js";
import { BudgetRepository } from "./budget.repository.js";
import type {
  SetupBudgetInput,
  UpdateBudgetInput,
  LogExpenseInput,
  BudgetHistoryQuery,
  TodayBudgetSummary,
  BudgetAnalytics,
  WeeklySummary,
} from "./types/budget.types.js";

export class BudgetService {
  constructor(private readonly budgetRepo = new BudgetRepository()) {}

  // ================== SET DAILY BUDGET (Calendar-based) ==================

  /**
   * Set a budget for a specific date (selected from calendar).
   * Only today or future dates allowed. Past dates are blocked.
   */
  async setDailyBudget(input: SetupBudgetInput) {
    await this.ensureMembership(input.userId, input.accountId);

    const selectedDate = new Date(input.date);
    selectedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      throw new AppError("Cannot configure budget for past dates", 400);
    }

    // Ensure an active config exists (create one if not)
    let activeConfig = await this.budgetRepo.getActiveBudgetConfig(
      input.accountId,
    );

    if (!activeConfig) {
      activeConfig = await this.budgetRepo.createBudgetConfig({
        accountId: input.accountId,
        mode: "daily",
        dailyAmount: input.amount,
      });
    }

    // Upsert daily budget for the selected date
    const dailyBudgetEntry = await this.budgetRepo.upsertDailyBudgetForDate({
      accountId: input.accountId,
      budgetConfigId: activeConfig.id,
      date: selectedDate,
      allocatedAmount: input.amount,
    });

    // Create version record
    await this.budgetRepo.createBudgetConfigVersion({
      budgetConfigId: activeConfig.id,
      mode: "daily",
      dailyAmount: input.amount,
      changedBy: input.userId,
      changeReason: `Budget set for ${selectedDate.toISOString().split("T")[0]}`,
    });

    return {
      dailyBudget: dailyBudgetEntry,
      date: selectedDate.toISOString(),
      allocatedAmount: input.amount,
      message: `Budget of $${input.amount} set for ${selectedDate.toLocaleDateString("en-US")}`,
    };
  }

  // ================== UPDATE BUDGET CONFIG ==================

  async updateBudget(input: UpdateBudgetInput) {
    await this.ensureMembership(input.userId, input.accountId);

    const activeConfig = await this.budgetRepo.getActiveBudgetConfig(
      input.accountId,
    );

    if (!activeConfig) {
      throw new AppError("No active budget configuration found", 404);
    }

    const newMode = input.mode || activeConfig.mode;
    let newDailyAmount = input.dailyAmount;
    let newWeeklyAmount = input.weeklyAmount;

    if (newMode === "daily" && newDailyAmount) {
      newWeeklyAmount = newDailyAmount * 7;
    } else if (newMode === "weekly" && newWeeklyAmount) {
      newDailyAmount = Number((newWeeklyAmount / 7).toFixed(2));
    } else {
      newDailyAmount = parseFloat(activeConfig.dailyAmount || "0");
      newWeeklyAmount = parseFloat(activeConfig.weeklyAmount || "0");
    }

    // Lock the current week to the old budget config so the new one applies starting next week.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
    nextSunday.setHours(0, 0, 0, 0);

    const oldDailyAmount = parseFloat(activeConfig.dailyAmount || "0");
    if (oldDailyAmount > 0) {
      for (
        let d = new Date(today);
        d < nextSunday;
        d.setDate(d.getDate() + 1)
      ) {
        const exists = await this.budgetRepo.existsDailyBudgetForDate(
          input.accountId,
          d,
        );
        if (!exists) {
          await this.budgetRepo.upsertDailyBudgetForDate({
            accountId: input.accountId,
            budgetConfigId: activeConfig.id,
            date: new Date(d),
            allocatedAmount: oldDailyAmount,
          });
        }
      }
    }

    await this.budgetRepo.createBudgetConfigVersion({
      budgetConfigId: activeConfig.id,
      mode: activeConfig.mode,
      dailyAmount: parseFloat(activeConfig.dailyAmount || "0"),
      weeklyAmount: parseFloat(activeConfig.weeklyAmount || "0"),
      changedBy: input.userId,
      changeReason: input.changeReason || "Budget updated",
    });

    const updatedConfig = await this.budgetRepo.updateBudgetConfig(
      activeConfig.id,
      {
        mode: newMode as "daily" | "weekly",
        dailyAmount: newDailyAmount,
        weeklyAmount: newWeeklyAmount,
      },
    );

    return updatedConfig;
  }

  // ================== LOG EXPENSE ==================

  async logExpense(input: LogExpenseInput) {
    await this.ensureMembership(input.userId, input.accountId);

    const expenseDate = new Date(input.date);
    expenseDate.setHours(0, 0, 0, 0);

    // Find the daily budget for this date
    let dailyBudget = await this.budgetRepo.getDailyBudgetByDate(
      input.accountId,
      expenseDate,
    );

    // If no budget for this date, try fallback to previous date's budget or active config
    // and auto-create a daily budget entry using the fallback amount
    if (!dailyBudget) {
      const fallbackBudget = await this.budgetRepo.getMostRecentPreviousBudget(
        input.accountId,
        expenseDate,
      );

      const activeConfig = await this.budgetRepo.getActiveBudgetConfig(
        input.accountId,
      );

      let fallbackAmount: number | null = null;
      let configIdToUse: string | null = null;

      if (fallbackBudget) {
        fallbackAmount = parseFloat(fallbackBudget.allocatedAmount);
        configIdToUse = activeConfig?.id || fallbackBudget.budgetConfigId;
      } else if (activeConfig && activeConfig.dailyAmount) {
        fallbackAmount = parseFloat(activeConfig.dailyAmount);
        configIdToUse = activeConfig.id;
      }

      if (fallbackAmount === null || !configIdToUse) {
        throw new AppError(
          "No budget found for this date and no previous budget or active config to use as fallback. Please set up a budget first.",
          404,
        );
      }

      // Auto-create a daily budget entry with the fallback amount
      await this.budgetRepo.upsertDailyBudgetForDate({
        accountId: input.accountId,
        budgetConfigId: configIdToUse,
        date: expenseDate,
        allocatedAmount: fallbackAmount,
      });

      // Re-fetch with the newly created budget
      dailyBudget = await this.budgetRepo.getDailyBudgetByDate(
        input.accountId,
        expenseDate,
      );
    }

    if (!dailyBudget) {
      throw new AppError("Failed to create budget entry", 500);
    }

    let newAmountSpent = input.amountSpent;
    let newCategories = input.categoriesBreakdown || {};

    if (input.isAdditive) {
      const existingExpense = await this.budgetRepo.getDailyExpenseByBudgetId(
        dailyBudget.dailyBudget.id,
      );

      if (existingExpense) {
        newAmountSpent += parseFloat(existingExpense.amountSpent || "0");

        const existingCats = (existingExpense.categoriesBreakdown ||
          {}) as Record<string, number>;
        const mergedCats = { ...existingCats };

        for (const [cat, val] of Object.entries(
          input.categoriesBreakdown || {},
        )) {
          mergedCats[cat] = (mergedCats[cat] || 0) + val;
        }
        newCategories = mergedCats;
      }
    }

    const expense = await this.budgetRepo.upsertDailyExpense({
      accountId: input.accountId,
      dailyBudgetId: dailyBudget.dailyBudget.id,
      date: expenseDate,
      amountSpent: newAmountSpent,
      categoriesBreakdown: newCategories,
      notes: input.notes,
      updatedBy: input.userId,
    });

    const allocatedAmount = parseFloat(dailyBudget.dailyBudget.allocatedAmount);
    const balance = allocatedAmount - newAmountSpent;

    return {
      expense,
      allocatedAmount,
      amountSpent: newAmountSpent,
      balance,
      isOverBudget: balance < 0,
    };
  }

  // ================== TODAY'S BUDGET ==================

  /**
   * Get today's budget summary.
   * If no budget set for today, falls back to the most recent previous date's budget.
   */
  async getTodayBudget(accountId: string): Promise<TodayBudgetSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeConfig = await this.budgetRepo.getActiveBudgetConfig(accountId);

    // Try to find budget for today
    const dailyBudget = await this.budgetRepo.getDailyBudgetByDate(
      accountId,
      today,
    );

    // Fallback: if no budget for today, use the most recent previous budget or active config
    if (!dailyBudget && activeConfig) {
      const previousBudget = await this.budgetRepo.getMostRecentPreviousBudget(
        accountId,
        today,
      );

      if (previousBudget) {
        // Return with fallback data (don't auto-create — let user explicitly set)
        return {
          date: today.toISOString(),
          allocatedAmount: parseFloat(previousBudget.allocatedAmount),
          amountSpent: 0,
          balance: parseFloat(previousBudget.allocatedAmount),
          hasExpenseLogged: false,
          isFallback: true,
          fallbackFromDate: previousBudget.date,
          configId: activeConfig.id,
        };
      } else if (activeConfig.dailyAmount) {
        // Fallback to active configuration default
        const fallbackAmount = parseFloat(activeConfig.dailyAmount);
        return {
          date: today.toISOString(),
          allocatedAmount: fallbackAmount,
          amountSpent: 0,
          balance: fallbackAmount,
          hasExpenseLogged: false,
          isFallback: true,
          fallbackFromDate: null,
          configId: activeConfig.id,
        };
      }
    }

    if (!dailyBudget || !activeConfig) {
      return {
        date: today.toISOString(),
        allocatedAmount: 0,
        amountSpent: 0,
        balance: 0,
        hasExpenseLogged: false,
        isFallback: false,
        fallbackFromDate: null,
        configId: activeConfig?.id || null,
      };
    }

    const allocatedAmount = parseFloat(dailyBudget.dailyBudget.allocatedAmount);
    const amountSpent = dailyBudget.expense
      ? parseFloat(dailyBudget.expense.amountSpent)
      : 0;
    const balance = allocatedAmount - amountSpent;

    return {
      date: today.toISOString(),
      allocatedAmount,
      amountSpent,
      balance,
      hasExpenseLogged: !!dailyBudget.expense,
      isFallback: false,
      fallbackFromDate: null,
      configId: activeConfig.id,
    };
  }

  // ================== WEEKLY SUMMARY ==================

  /**
   * Returns a Sun–Sat weekly breakdown of budget vs spent.
   * For days without an explicit budget, uses fallback from the most recent previous date.
   */
  async getWeeklySummary(accountId: string): Promise<WeeklySummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find Sunday (start of current week)
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = [];

    let totalBudget = 0;
    let totalSpent = 0;

    // Track the last known budget amount for fallback
    let lastKnownBudgetAmount = 0;

    // First try active config as a baseline
    const activeConfig = await this.budgetRepo.getActiveBudgetConfig(accountId);
    if (activeConfig && activeConfig.dailyAmount) {
      lastKnownBudgetAmount = parseFloat(activeConfig.dailyAmount);
    }

    // Get the most recent budget before this week for initial fallback override
    const previousBudget = await this.budgetRepo.getMostRecentPreviousBudget(
      accountId,
      weekStart,
    );
    if (previousBudget) {
      lastKnownBudgetAmount = parseFloat(previousBudget.allocatedAmount);
    }

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);

      const dailyData = await this.budgetRepo.getDailyBudgetByDate(
        accountId,
        dayDate,
      );

      let allocatedAmount = 0;
      let amountSpent = 0;
      let hasBudget = false;
      let hasExpense = false;
      let isFallback = false;

      if (dailyData) {
        allocatedAmount = parseFloat(dailyData.dailyBudget.allocatedAmount);
        amountSpent = dailyData.expense
          ? parseFloat(dailyData.expense.amountSpent)
          : 0;
        hasBudget = true;
        hasExpense = !!dailyData.expense;
        lastKnownBudgetAmount = allocatedAmount;
      } else if (lastKnownBudgetAmount > 0 && dayDate <= today) {
        // Fallback: use last known budget for past/today
        allocatedAmount = lastKnownBudgetAmount;
        isFallback = true;
      }

      totalBudget += allocatedAmount;
      totalSpent += amountSpent;

      days.push({
        date: dayDate.toISOString(),
        dayName: dayNames[i],
        allocatedAmount,
        amountSpent,
        balance: allocatedAmount - amountSpent,
        hasBudget,
        hasExpense,
        isFallback,
      });
    }

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBudget,
      totalSpent,
      totalBalance: totalBudget - totalSpent,
      days,
    };
  }

  // ================== BUDGET HISTORY ==================

  async getBudgetHistory(accountId: string, query: BudgetHistoryQuery) {
    return this.budgetRepo.getDailyBudgetsWithExpenses(accountId, query);
  }

  // ================== ANALYTICS ==================

  async getAnalytics(
    accountId: string,
    period: "weekly" | "monthly",
  ): Promise<BudgetAnalytics> {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    if (period === "weekly") {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);

    const rawData = await this.budgetRepo.getAnalyticsData(
      accountId,
      startDate,
      endDate,
    );

    let totalBudget = 0;
    let totalSpent = 0;
    let daysOverBudget = 0;
    let daysUnderBudget = 0;
    let daysWithData = 0;
    const categoryTotals: Record<string, number> = {};

    const dailyData = rawData.map((row: any) => {
      const budget = parseFloat(row.allocatedAmount || "0");
      const spent = parseFloat(row.amountSpent || "0");
      const balance = budget - spent;
      const cats = row.categoriesBreakdown || {};

      for (const [key, val] of Object.entries(cats)) {
        categoryTotals[key] = (categoryTotals[key] || 0) + Number(val);
      }

      totalBudget += budget;
      totalSpent += spent;

      if (row.amountSpent !== null) {
        daysWithData++;
        if (spent > budget) daysOverBudget++;
        else daysUnderBudget++;
      }

      return {
        date: row.date,
        budget,
        spent,
        balance,
      };
    });

    return {
      period,
      totalBudget,
      totalSpent,
      totalBalance: totalBudget - totalSpent,
      daysOverBudget,
      daysUnderBudget,
      averageDailySpending: daysWithData > 0 ? totalSpent / daysWithData : 0,
      categoriesBreakdown: categoryTotals,
      dailyData,
    };
  }

  // ================== PENDING UPDATES ==================

  async getPendingUpdates(accountId: string) {
    return this.budgetRepo.getPendingExpenseUpdates(accountId);
  }

  // ================== CONFIG VERSIONS ==================

  async getConfigVersions(accountId: string) {
    const config = await this.budgetRepo.getActiveBudgetConfig(accountId);
    if (!config) return [];
    return this.budgetRepo.getBudgetConfigVersions(config.id);
  }

  // ================== HELPERS ==================

  private async ensureMembership(userId: string, accountId: string) {
    const isMember = await this.budgetRepo.isUserMemberOfAccount(
      userId,
      accountId,
    );
    if (!isMember) {
      throw new AppError("User is not a member of this account", 403);
    }
  }
}
