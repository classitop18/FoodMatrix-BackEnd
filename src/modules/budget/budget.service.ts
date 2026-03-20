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
  LogExpenseFromReceiptInput,
  ExpenseDetailResult,
  ReceiptExpenseDetail,
} from "./types/budget.types.js";

import dayjs from "dayjs";
export class BudgetService {
  constructor(private readonly budgetRepo = new BudgetRepository()) {}

  /**
   * Helper to format a local Date object into an ISO string without timezone shifts.
   * Ensures the resulting `YYYY-MM-DD` literal exactly matches the local time components.
   */
  private formatLocalToISO(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // ================== SET DAILY BUDGET (Calendar-based) ==================

  /**
   * Set a budget for a specific date (selected from calendar).
   * Only today or future dates allowed. Past dates are blocked.
   */
  async setDailyBudget(input: SetupBudgetInput) {
    await this.ensureMembership(input.userId, input.accountId);

    const [year, month, day] = input.date.split("T")[0].split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);

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
      changeReason: `Budget set for ${this.formatLocalToISO(selectedDate).split("T")[0]}`,
    });

    return {
      dailyBudget: dailyBudgetEntry,
      date: this.formatLocalToISO(selectedDate),
      allocatedAmount: input.amount,
      message: `Budget of $${input.amount} set for ${selectedDate.toLocaleDateString("en-US")}`,
    };
  }

  // ================== UPDATE BUDGET CONFIG ==================

  async updateBudget(input: UpdateBudgetInput) {
    await this.ensureMembership(input.userId, input.accountId);

    if (input.overrideCurrentWeek) {
      const status = await this.getCurrentWeekStatus(input.accountId);
      if (status.attemptsLeft <= 0) {
        throw new AppError(
          "Maximum attempts reached for overriding the current week's budget.",
          400,
        );
      }
    }

    let activeConfig = await this.budgetRepo.getActiveBudgetConfig(
      input.accountId,
    );

    if (!activeConfig) {
      // Create an initial empty config if it doesn't exist so the pipeline can continue
      activeConfig = await this.budgetRepo.createBudgetConfig({
        accountId: input.accountId,
        mode: input.mode || "weekly",
        dailyAmount: 0,
        weeklyAmount: 0,
      });
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

    // Lock logic:
    // If overrideCurrentWeek is true, we immediately update the ENTIRE current week with the NEW amount.
    // If false (default), we lock the rest of the current week to the OLD budget config, so new one applies next Sunday.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
    nextSunday.setHours(0, 0, 0, 0);

    const oldDailyAmount = parseFloat(activeConfig.dailyAmount || "0");
    const amountToApplyToCurrentWeek = input.overrideCurrentWeek
      ? newDailyAmount
      : oldDailyAmount;

    const startUpdateDate = new Date(today);
    if (input.overrideCurrentWeek) {
      startUpdateDate.setDate(today.getDate() - dayOfWeek); // Start from Sunday
    }

    if (amountToApplyToCurrentWeek > 0) {
      for (
        let d = new Date(startUpdateDate);
        d < nextSunday;
        d.setDate(d.getDate() + 1)
      ) {
        if (input.overrideCurrentWeek) {
          // Force update the daily budget for the rest of the week
          await this.budgetRepo.upsertDailyBudgetForDate({
            accountId: input.accountId,
            budgetConfigId: activeConfig.id,
            date: new Date(d),
            allocatedAmount: amountToApplyToCurrentWeek,
          });
        } else {
          // Lock ONLY if it doesn't already exist
          const exists = await this.budgetRepo.existsDailyBudgetForDate(
            input.accountId,
            d,
          );
          if (!exists) {
            await this.budgetRepo.upsertDailyBudgetForDate({
              accountId: input.accountId,
              budgetConfigId: activeConfig.id,
              date: new Date(d),
              allocatedAmount: amountToApplyToCurrentWeek,
            });
          }
        }
      }
    }

    await this.budgetRepo.createBudgetConfigVersion({
      budgetConfigId: activeConfig.id,
      mode: activeConfig.mode,
      dailyAmount: parseFloat(activeConfig.dailyAmount || "0"),
      weeklyAmount: parseFloat(activeConfig.weeklyAmount || "0"),
      changedBy: input.userId,
      changeReason: input.overrideCurrentWeek
        ? "Current week budget override"
        : input.changeReason || "Budget updated",
    });

    const updatedConfig = await this.budgetRepo.updateBudgetConfig(
      activeConfig.id,
      {
        mode: newMode as "daily" | "weekly",
        dailyAmount: newDailyAmount,
        weeklyAmount: newWeeklyAmount,
      },
    );

    // If weekly mode, create/update daily budget entries for the upcoming week
    // so the weekly amount gets distributed evenly across 7 days
    if (newMode === "weekly" && newDailyAmount && newDailyAmount > 0) {
      const nextWeekSaturday = new Date(nextSunday);
      nextWeekSaturday.setDate(nextSunday.getDate() + 6);

      for (
        let d = new Date(nextSunday);
        d <= nextWeekSaturday;
        d.setDate(d.getDate() + 1)
      ) {
        await this.budgetRepo.upsertDailyBudgetForDate({
          accountId: input.accountId,
          budgetConfigId: activeConfig.id,
          date: new Date(d),
          allocatedAmount: newDailyAmount,
        });
      }
    }

    return updatedConfig;
  }

  // ================== LOG EXPENSE ==================

  async logExpense(input: LogExpenseInput) {
    await this.ensureMembership(input.userId, input.accountId);

    const [year, month, day] = input.date.split("T")[0].split("-").map(Number);
    const expenseDate = new Date(year, month - 1, day);

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
          date: this.formatLocalToISO(today),
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
          date: this.formatLocalToISO(today),
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
        date: this.formatLocalToISO(today),
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
      date: this.formatLocalToISO(today),
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

  async getWeeklySummary(
    accountId: string,
    dateStr?: string,
  ): Promise<WeeklySummary> {
    const today = dateStr
      ? dayjs(dateStr).startOf("day") // ✅ force local start
      : dayjs().startOf("day");

    // ✅ week from Sunday
    const weekStart = today.startOf("week");
    const weekEnd = weekStart.add(6, "day").endOf("day");

    const days = [];

    let totalBudget = 0;
    let totalSpent = 0;
    let lastKnownBudgetAmount = 0;

    // Active config
    const activeConfig = await this.budgetRepo.getActiveBudgetConfig(accountId);
    if (activeConfig?.dailyAmount) {
      lastKnownBudgetAmount = parseFloat(activeConfig.dailyAmount);
    }

    // Previous budget
    const previousBudget = await this.budgetRepo.getMostRecentPreviousBudget(
      accountId,
      weekStart.toDate(),
    );

    if (previousBudget) {
      lastKnownBudgetAmount = parseFloat(previousBudget.allocatedAmount);
    }

    for (let i = 0; i < 7; i++) {
      const dayDate = weekStart.add(i, "day").startOf("day");
      console.log(dayDate, "dayDatedayDatedayDate");

      const dailyData = await this.budgetRepo.getDailyBudgetByDate(
        accountId,
        dayDate.toDate(), // DB ke liye OK
      );

      console.log(`Daily data : ${dailyData}`);

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
      } else if (lastKnownBudgetAmount > 0) {
        allocatedAmount = lastKnownBudgetAmount;
        isFallback = true;
      }

      totalBudget += allocatedAmount;
      totalSpent += amountSpent;

      days.push({
        date: dayDate.format("YYYY-MM-DD"), // ✅ FIX (NO ISO)
        dayName: dayDate.format("ddd"), // ✅ always correct
        allocatedAmount,
        amountSpent,
        balance: allocatedAmount - amountSpent,
        hasBudget,
        hasExpense,
        isFallback,
      });
    }

    return {
      weekStart: weekStart.format("YYYY-MM-DD"), // ✅ FIX
      weekEnd: weekEnd.format("YYYY-MM-DD"), // ✅ FIX
      totalBudget,
      totalSpent,
      totalBalance: totalBudget - totalSpent,
      days,
    };
  }
  // ================== BUDGET HISTORY ==================

  async getBudgetHistory(accountId: string, query: BudgetHistoryQuery) {
    await this.syncPastBudgets(accountId);
    const history = await this.budgetRepo.getDailyBudgetsWithExpenses(
      accountId,
      query,
    );

    const uniqueMap = new Map();
    for (const item of history.data) {
      const d = this.formatLocalToISO(new Date(item.date));
      if (!uniqueMap.has(d)) {
        uniqueMap.set(d, { ...item, date: d });
      } else {
        const existing = uniqueMap.get(d);
        if (existing.amountSpent === null && item.amountSpent !== null) {
          uniqueMap.set(d, { ...item, date: d });
        }
      }
    }

    const finalData = Array.from(uniqueMap.values());
    finalData.sort((a, b) => b.date.localeCompare(a.date));

    return {
      total: finalData.length,
      data: finalData,
    };
  }

  // ================== ANALYTICS ==================

  async getAnalytics(
    accountId: string,
    period: "weekly" | "monthly" | "yearly" | "custom",
    yearStr?: string,
    monthStr?: string,
    weekDateStr?: string,
  ): Promise<BudgetAnalytics> {
    try {
      await this.syncPastBudgets(accountId);
    } catch (syncError) {
      // Don't let sync failure break analytics
      console.error("syncPastBudgets failed (non-fatal):", syncError);
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    if (period === "weekly" || (period === "custom" && weekDateStr)) {
      if (weekDateStr) {
        // If a specific week was requested
        const [year, month, day] = weekDateStr
          .split("T")[0]
          .split("-")
          .map(Number);
        const targetDate = new Date(year, month - 1, day);
        const dayOfWeek = targetDate.getDay();
        startDate.setTime(targetDate.getTime());
        startDate.setDate(targetDate.getDate() - dayOfWeek); // Sunday
        endDate.setTime(startDate.getTime());
        endDate.setDate(startDate.getDate() + 6); // Saturday
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Default rolling 7 days
        startDate.setDate(startDate.getDate() - 7);
      }
    } else if (period === "monthly" || period === "yearly") {
      const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
      if (period === "monthly") {
        if (monthStr) {
          // Specific month
          const month = parseInt(monthStr, 10);
          startDate.setFullYear(year, month - 1, 1); // First day of month
          endDate.setFullYear(year, month, 0); // Last day of month
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default rolling 30 days
          startDate.setDate(startDate.getDate() - 30);
        }
      } else if (period === "yearly") {
        startDate.setFullYear(year, 0, 1);
        endDate.setFullYear(year, 11, 31);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    startDate.setHours(0, 0, 0, 0);

    const rawData = await this.budgetRepo.getAnalyticsData(
      accountId,
      startDate,
      endDate,
    );

    const uniqueMap = new Map();
    for (const row of rawData) {
      const d = this.formatLocalToISO(new Date(row.date));
      if (!uniqueMap.has(d)) {
        uniqueMap.set(d, row);
      } else {
        const existing = uniqueMap.get(d);
        if (existing.amountSpent === null && row.amountSpent !== null) {
          uniqueMap.set(d, row);
        }
      }
    }
    const deduplicatedData = Array.from(uniqueMap.values());

    let totalBudget = 0;
    let totalSpent = 0;
    let daysOverBudget = 0;
    let daysUnderBudget = 0;
    let daysWithData = 0;
    const categoryTotals: Record<string, number> = {};

    const dailyData = deduplicatedData.map((row: any) => {
      const budget = parseFloat(row.allocatedAmount || "0");
      const spent = parseFloat(row.amountSpent || "0");
      const balance = budget - spent;
      const cats =
        row.categoriesBreakdown && typeof row.categoriesBreakdown === "object"
          ? (row.categoriesBreakdown as Record<string, unknown>)
          : {};

      for (const [key, val] of Object.entries(cats)) {
        categoryTotals[key] = (categoryTotals[key] || 0) + Number(val || 0);
      }

      totalBudget += budget;
      totalSpent += spent;

      if (row.amountSpent !== null) {
        daysWithData++;
        if (spent > budget) daysOverBudget++;
        else daysUnderBudget++;
      }

      return {
        date: this.formatLocalToISO(new Date(row.date)),
        budget,
        spent,
        balance,
      };
    });

    let finalDailyData: typeof dailyData = [];

    // If period is yearly, aggregate the data by month to prevent rendering 365 bars in chart
    if (period === "yearly") {
      const monthlyAggregations: Record<
        number,
        { budget: number; spent: number; balance: number; date: string }
      > = {};
      for (let i = 0; i < 12; i++) {
        monthlyAggregations[i] = {
          budget: 0,
          spent: 0,
          balance: 0,
          date: this.formatLocalToISO(new Date(startDate.getFullYear(), i, 1)),
        };
      }

      dailyData.forEach((d: any) => {
        const dateObj = new Date(d.date);
        const monthIndex = dateObj.getMonth();
        monthlyAggregations[monthIndex].budget += d.budget;
        monthlyAggregations[monthIndex].spent += d.spent;
        monthlyAggregations[monthIndex].balance += d.balance;
      });

      finalDailyData = Object.values(monthlyAggregations);
    } else {
      finalDailyData = dailyData;
    }

    return {
      period,
      totalBudget,
      totalSpent,
      totalBalance: totalBudget - totalSpent,
      daysOverBudget,
      daysUnderBudget,
      averageDailySpending: daysWithData > 0 ? totalSpent / daysWithData : 0,
      categoriesBreakdown: categoryTotals,
      dailyData: finalDailyData,
    };
  }

  // ================== PENDING UPDATES ==================

  async getPendingUpdates(accountId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const history = await this.budgetRepo.getDailyBudgetsWithExpenses(
      accountId,
      {
        startDate: startOfWeek.toISOString(),
        endDate: today.toISOString(),
        page: 1,
        limit: 100,
      },
    );

    const datesWithExpenses = new Set<string>();
    for (const item of history.data) {
      if (item.amountSpent !== null) {
        datesWithExpenses.add(this.formatLocalToISO(new Date(item.date)));
      }
    }

    const updates = await this.budgetRepo.getPendingExpenseUpdates(accountId);
    const uniqueMap = new Map();
    const finalData = [];
    for (const u of updates) {
      const d = this.formatLocalToISO(new Date(u.date));
      if (!uniqueMap.has(d) && !datesWithExpenses.has(d)) {
        uniqueMap.set(d, true);
        finalData.push({ ...u, date: d });
      }
    }
    return finalData;
  }

  // ================== CONFIG VERSIONS ==================

  async getConfigVersions(accountId: string) {
    const config = await this.budgetRepo.getActiveBudgetConfig(accountId);
    if (!config) return [];
    return this.budgetRepo.getBudgetConfigVersions(config.id);
  }

  // ================== LOG EXPENSE FROM RECEIPT ==================

  async logExpenseFromReceipt(input: LogExpenseFromReceiptInput) {
    await this.ensureMembership(input.userId, input.accountId);

    // Fetch the receipt
    const { receipts } = await import("../../database/schemas/receipts.js");
    const { eq, and } = await import("drizzle-orm");
    const { getDb } = await import("../../database/db.js");
    const db = getDb();

    const [receipt] = await db
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.id, input.receiptId),
          eq(receipts.accountId, input.accountId),
        ),
      )
      .limit(1);

    if (!receipt) {
      throw new AppError("Receipt not found", 404);
    }

    // ── Duplicate check: prevent same receipt from deducting on the same date twice ──
    const [year, month, day] = input.date.split("T")[0].split("-").map(Number);
    const expenseDate = new Date(year, month - 1, day);

    const alreadyLinked = await this.budgetRepo.hasReceiptExpenseForDate(
      input.receiptId,
      input.accountId,
      expenseDate,
    );

    if (alreadyLinked) {
      throw new AppError(
        "This receipt has already been deducted from the budget for this date",
        409,
      );
    }

    // Extract food-related items from aiAuditedItems
    const aiItems: any[] = Array.isArray(receipt.aiAuditedItems)
      ? receipt.aiAuditedItems
      : [];

    const foodItems = aiItems.filter(
      (item: any) => !["household", "other"].includes(item.category),
    );

    if (foodItems.length === 0) {
      throw new AppError(
        "No food items found in this receipt to deduct from budget",
        400,
      );
    }

    // Calculate food total
    const foodTotal = foodItems.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.price) || 0),
      0,
    );

    if (foodTotal <= 0) {
      throw new AppError("Food items total is zero or negative", 400);
    }

    const categoriesBreakdown: Record<string, number> = {};
    for (const item of foodItems) {
      const cat = item.category || "food";
      categoriesBreakdown[cat] =
        (categoriesBreakdown[cat] || 0) + (parseFloat(item.price) || 0);
    }

    // Log the expense using existing additive method
    const expenseResult = await this.logExpense({
      accountId: input.accountId,
      date: input.date,
      amountSpent: foodTotal,
      categoriesBreakdown,
      notes: input.note || `Receipt: ${receipt.storeName || "Unknown Store"}`,
      userId: input.userId,
      isAdditive: true,
    });

    // Create the receipt-expense link
    const receiptExpenseEntry = await this.budgetRepo.createReceiptExpense({
      dailyExpenseId: expenseResult.expense.id,
      receiptId: input.receiptId,
      accountId: input.accountId,
      amount: foodTotal,
      itemsSnapshot: foodItems.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        category: item.category,
        brand: item.brand,
      })),
      note: input.note,
      linkedBy: input.userId,
    });

    return {
      ...expenseResult,
      receiptExpense: receiptExpenseEntry,
      foodTotal,
      foodItemsCount: foodItems.length,
      storeName: receipt.storeName,
    };
  }

  // ================== EXPENSE DETAILS ==================

  async getExpenseDetails(
    accountId: string,
    dailyBudgetId: string,
  ): Promise<ExpenseDetailResult> {
    // Get the daily budget + expense
    const { dailyBudgets, dailyExpenses } =
      await import("../../database/schemas/schema.js");
    const { eq } = await import("drizzle-orm");
    const { getDb } = await import("../../database/db.js");
    const db = getDb();

    const [budgetRow] = await db
      .select({
        dailyBudget: dailyBudgets,
        expense: dailyExpenses,
      })
      .from(dailyBudgets)
      .leftJoin(dailyExpenses, eq(dailyBudgets.id, dailyExpenses.dailyBudgetId))
      .where(eq(dailyBudgets.id, dailyBudgetId))
      .limit(1);

    if (!budgetRow) {
      throw new AppError("Daily budget not found", 404);
    }

    const receiptExpensesList: ReceiptExpenseDetail[] = [];

    if (budgetRow.expense) {
      // Get all linked receipt expenses
      const rawEntries =
        await this.budgetRepo.getReceiptExpensesByDailyExpenseId(
          budgetRow.expense.id,
        );

      // Enrich with receipt store name
      const { receipts } = await import("../../database/schemas/receipts.js");

      for (const entry of rawEntries) {
        let storeName: string | null = null;
        try {
          const [receipt] = await db
            .select({ storeName: receipts.storeName })
            .from(receipts)
            .where(eq(receipts.id, entry.receiptId))
            .limit(1);
          storeName = receipt?.storeName ?? null;
        } catch {
          // Receipt may have been deleted
        }

        receiptExpensesList.push({
          id: entry.id,
          receiptId: entry.receiptId,
          amount: entry.amount,
          itemsSnapshot: Array.isArray(entry.itemsSnapshot)
            ? entry.itemsSnapshot
            : [],
          note: entry.note,
          linkedAt: entry.linkedAt?.toISOString?.() || entry.linkedAt,
          storeName,
        });
      }
    }

    const allocatedAmount = budgetRow.dailyBudget.allocatedAmount;
    const amountSpent = budgetRow.expense?.amountSpent || "0";
    const balance = parseFloat(allocatedAmount) - parseFloat(amountSpent);

    return {
      dailyBudgetId,
      date: this.formatLocalToISO(new Date(budgetRow.dailyBudget.date!)),
      allocatedAmount,
      amountSpent,
      balance,
      receiptExpenses: receiptExpensesList,
    };
  }

  // ================== HELPERS ==================

  private async syncPastBudgets(accountId: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeConfig =
        await this.budgetRepo.getActiveBudgetConfig(accountId);
      if (!activeConfig || !activeConfig.dailyAmount) return;

      const fallbackAmount = parseFloat(activeConfig.dailyAmount);
      if (fallbackAmount <= 0) return;

      const startSyncDate = activeConfig.effectiveFrom
        ? new Date(activeConfig.effectiveFrom)
        : new Date(today);
      startSyncDate.setHours(0, 0, 0, 0);

      const minSyncDate = new Date(today);
      minSyncDate.setDate(minSyncDate.getDate() - 90); // Sync max 90 days back

      const actualStartDate =
        startSyncDate < minSyncDate ? minSyncDate : startSyncDate;
      if (actualStartDate >= today) return;

      const existingBudgets = await this.budgetRepo.getAnalyticsData(
        accountId,
        actualStartDate,
        today,
      );
      const existingDates = new Set(
        existingBudgets.map((b: any) => {
          const d = new Date(b.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }),
      );

      const missingEntries = [];
      for (
        let d = new Date(actualStartDate);
        d < today;
        d.setDate(d.getDate() + 1)
      ) {
        const dTime = new Date(d).getTime();
        if (!existingDates.has(dTime)) {
          missingEntries.push({
            accountId,
            budgetConfigId: activeConfig.id,
            date: new Date(d),
            allocatedAmount: fallbackAmount,
          });
        }
      }

      if (missingEntries.length > 0) {
        await this.budgetRepo.createDailyBudgetsBulk(missingEntries);
      }
    } catch (error) {
      console.error("Failed to sync past budgets:", error);
    }
  }

  private async ensureMembership(userId: string, accountId: string) {
    const isMember = await this.budgetRepo.isUserMemberOfAccount(
      userId,
      accountId,
    );
    if (!isMember) {
      throw new AppError("User is not a member of this account", 403);
    }
  }

  // ================== CURRENT WEEK STATUS  ==================

  async getCurrentWeekStatus(accountId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay(); // 0 = Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const config = await this.budgetRepo.getActiveBudgetConfig(accountId);
    if (!config) {
      return { attemptsLeft: 3, maxAttempts: 3, usedAttempts: 0 };
    }

    const versions = await this.budgetRepo.getBudgetConfigVersions(config.id);

    // Count how many overriding versions were created this week
    let usedAttempts = 0;
    for (const v of versions) {
      if (
        v.changeReason === "Current week budget override" &&
        new Date(v.createdAt) >= startOfWeek
      ) {
        usedAttempts++;
      }
    }

    const maxAttempts = 3;
    const attemptsLeft = Math.max(0, maxAttempts - usedAttempts);

    return { attemptsLeft, maxAttempts, usedAttempts };
  }
}
