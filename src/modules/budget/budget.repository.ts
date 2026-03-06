import {
  and,
  eq,
  gte,
  lte,
  sql,
  desc,
  isNull,
  asc,
  count,
  lt,
} from "drizzle-orm";
import {
  budgetConfigs,
  budgetConfigVersions,
  dailyBudgets,
  dailyExpenses,
} from "../../database/schemas/schema.js";
import { getDb } from "../../database/db.js";
import type {
  BudgetHistoryQuery,
  DailyBudgetWithExpense,
  PendingUpdate,
} from "./types/budget.types.js";

export class BudgetRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  // ================== BUDGET CONFIG ==================

  async createBudgetConfig(data: {
    accountId: string;
    mode: "daily" | "weekly";
    dailyAmount?: number;
    weeklyAmount?: number;
    effectiveFrom?: Date;
  }) {
    // Deactivate existing active configs for the account
    await this.db
      .update(budgetConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(budgetConfigs.accountId, data.accountId),
          eq(budgetConfigs.isActive, true),
        ),
      );

    const [config] = await this.db
      .insert(budgetConfigs)
      .values({
        accountId: data.accountId,
        mode: data.mode,
        dailyAmount: data.dailyAmount?.toString(),
        weeklyAmount: data.weeklyAmount?.toString(),
        isActive: true,
        effectiveFrom: data.effectiveFrom || new Date(),
      })
      .returning();

    return config;
  }

  async getActiveBudgetConfig(accountId: string) {
    const result = await this.db
      .select()
      .from(budgetConfigs)
      .where(
        and(
          eq(budgetConfigs.accountId, accountId),
          eq(budgetConfigs.isActive, true),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  async updateBudgetConfig(
    configId: string,
    data: Partial<{
      mode: "daily" | "weekly";
      dailyAmount: number;
      weeklyAmount: number;
    }>,
  ) {
    const updateData: any = { updatedAt: new Date() };
    if (data.mode) updateData.mode = data.mode;
    if (data.dailyAmount !== undefined)
      updateData.dailyAmount = data.dailyAmount.toString();
    if (data.weeklyAmount !== undefined)
      updateData.weeklyAmount = data.weeklyAmount.toString();

    const [updated] = await this.db
      .update(budgetConfigs)
      .set(updateData)
      .where(eq(budgetConfigs.id, configId))
      .returning();

    return updated ?? null;
  }

  // ================== BUDGET CONFIG VERSIONS ==================

  async createBudgetConfigVersion(data: {
    budgetConfigId: string;
    mode: "daily" | "weekly";
    dailyAmount?: number;
    weeklyAmount?: number;
    changedBy: string;
    changeReason?: string;
  }) {
    const [maxVersion] = await this.db
      .select({
        maxVer: sql<number>`COALESCE(MAX(${budgetConfigVersions.version}), 0)`,
      })
      .from(budgetConfigVersions)
      .where(eq(budgetConfigVersions.budgetConfigId, data.budgetConfigId));

    const nextVersion = (maxVersion?.maxVer || 0) + 1;

    const [version] = await this.db
      .insert(budgetConfigVersions)
      .values({
        budgetConfigId: data.budgetConfigId,
        version: nextVersion,
        mode: data.mode,
        dailyAmount: data.dailyAmount?.toString(),
        weeklyAmount: data.weeklyAmount?.toString(),
        changedBy: data.changedBy,
        changeReason: data.changeReason,
      })
      .returning();

    return version;
  }

  async getBudgetConfigVersions(configId: string) {
    return this.db
      .select()
      .from(budgetConfigVersions)
      .where(eq(budgetConfigVersions.budgetConfigId, configId))
      .orderBy(desc(budgetConfigVersions.version));
  }

  // ================== DAILY BUDGETS ==================

  /**
   * Create or update a daily budget for a specific date.
   * If one already exists for that date, update the amount.
   */
  async upsertDailyBudgetForDate(data: {
    accountId: string;
    budgetConfigId: string;
    date: Date;
    allocatedAmount: number;
  }) {
    const startOfDay = new Date(data.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(data.date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if one already exists
    const existing = await this.db
      .select()
      .from(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.accountId, data.accountId),
          gte(dailyBudgets.date, startOfDay),
          lte(dailyBudgets.date, endOfDay),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const [updated] = await this.db
        .update(dailyBudgets)
        .set({
          allocatedAmount: data.allocatedAmount.toString(),
          budgetConfigId: data.budgetConfigId,
        })
        .where(eq(dailyBudgets.id, existing[0].id))
        .returning();
      return updated;
    }

    // Create new
    const [budget] = await this.db
      .insert(dailyBudgets)
      .values({
        accountId: data.accountId,
        budgetConfigId: data.budgetConfigId,
        date: startOfDay,
        allocatedAmount: data.allocatedAmount.toString(),
      })
      .returning();

    return budget;
  }

  async createDailyBudgetsBulk(
    entries: {
      accountId: string;
      budgetConfigId: string;
      date: Date;
      allocatedAmount: number;
    }[],
  ) {
    if (entries.length === 0) return [];

    const values = entries.map((e) => ({
      accountId: e.accountId,
      budgetConfigId: e.budgetConfigId,
      date: e.date,
      allocatedAmount: e.allocatedAmount.toString(),
    }));

    return this.db.insert(dailyBudgets).values(values).returning();
  }

  async getDailyBudgetByDate(accountId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.db
      .select({
        dailyBudget: dailyBudgets,
        expense: dailyExpenses,
      })
      .from(dailyBudgets)
      .leftJoin(dailyExpenses, eq(dailyBudgets.id, dailyExpenses.dailyBudgetId))
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          gte(dailyBudgets.date, startOfDay),
          lte(dailyBudgets.date, endOfDay),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Get the most recent daily budget BEFORE a given date.
   * Used for fallback when no budget is set for a specific date.
   */
  async getMostRecentPreviousBudget(accountId: string, beforeDate: Date) {
    const startOfDay = new Date(beforeDate);
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.db
      .select()
      .from(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          lt(dailyBudgets.date, startOfDay),
        ),
      )
      .orderBy(desc(dailyBudgets.date))
      .limit(1);

    return result[0] ?? null;
  }

  async getDailyBudgetsWithExpenses(
    accountId: string,
    query: BudgetHistoryQuery,
  ): Promise<{ data: DailyBudgetWithExpense[]; total: number }> {
    const conditions = [eq(dailyBudgets.accountId, accountId)];

    if (query.startDate) {
      conditions.push(gte(dailyBudgets.date, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(dailyBudgets.date, new Date(query.endDate)));
    }

    const page = query.page || 1;
    const limit = query.limit || 30;
    const offset = (page - 1) * limit;

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(dailyBudgets)
      .where(and(...conditions));

    const data = await this.db
      .select({
        id: dailyBudgets.id,
        date: dailyBudgets.date,
        allocatedAmount: dailyBudgets.allocatedAmount,
        amountSpent: dailyExpenses.amountSpent,
        notes: dailyExpenses.notes,
        expenseId: dailyExpenses.id,
      })
      .from(dailyBudgets)
      .leftJoin(dailyExpenses, eq(dailyBudgets.id, dailyExpenses.dailyBudgetId))
      .where(and(...conditions))
      .orderBy(desc(dailyBudgets.date))
      .limit(limit)
      .offset(offset);

    const mapped: DailyBudgetWithExpense[] = data.map((row: any) => ({
      id: row.id,
      date: row.date,
      allocatedAmount: row.allocatedAmount,
      amountSpent: row.amountSpent,
      balance:
        parseFloat(row.allocatedAmount) - parseFloat(row.amountSpent || "0"),
      notes: row.notes,
      expenseId: row.expenseId,
    }));

    return { data: mapped, total: totalResult.count };
  }

  async deleteFutureDailyBudgets(accountId: string, fromDate: Date) {
    return this.db
      .delete(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          gte(dailyBudgets.date, fromDate),
        ),
      );
  }

  async existsDailyBudgetForDate(
    accountId: string,
    date: Date,
  ): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.db
      .select({ id: dailyBudgets.id })
      .from(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          gte(dailyBudgets.date, startOfDay),
          lte(dailyBudgets.date, endOfDay),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  // ================== DAILY EXPENSES ==================

  async upsertDailyExpense(data: {
    accountId: string;
    dailyBudgetId: string;
    date: Date;
    amountSpent: number;
    notes?: string;
    updatedBy: string;
  }) {
    const existing = await this.db
      .select()
      .from(dailyExpenses)
      .where(eq(dailyExpenses.dailyBudgetId, data.dailyBudgetId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(dailyExpenses)
        .set({
          amountSpent: data.amountSpent.toString(),
          notes: data.notes,
          updatedBy: data.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(dailyExpenses.id, existing[0].id))
        .returning();

      return updated;
    }

    const [expense] = await this.db
      .insert(dailyExpenses)
      .values({
        accountId: data.accountId,
        dailyBudgetId: data.dailyBudgetId,
        date: data.date,
        amountSpent: data.amountSpent.toString(),
        notes: data.notes,
        updatedBy: data.updatedBy,
      })
      .returning();

    return expense;
  }

  // ================== PENDING UPDATES ==================

  async getPendingExpenseUpdates(accountId: string): Promise<PendingUpdate[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.db
      .select({
        date: dailyBudgets.date,
        allocatedAmount: dailyBudgets.allocatedAmount,
        dailyBudgetId: dailyBudgets.id,
        expenseId: dailyExpenses.id,
      })
      .from(dailyBudgets)
      .leftJoin(dailyExpenses, eq(dailyBudgets.id, dailyExpenses.dailyBudgetId))
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          lt(dailyBudgets.date, today),
          isNull(dailyExpenses.id),
        ),
      )
      .orderBy(desc(dailyBudgets.date));

    return result.map((row: any) => ({
      date: row.date,
      allocatedAmount: parseFloat(row.allocatedAmount),
      dailyBudgetId: row.dailyBudgetId,
    }));
  }

  // ================== ANALYTICS ==================

  async getAnalyticsData(accountId: string, startDate: Date, endDate: Date) {
    const data = await this.db
      .select({
        date: dailyBudgets.date,
        allocatedAmount: dailyBudgets.allocatedAmount,
        amountSpent: dailyExpenses.amountSpent,
      })
      .from(dailyBudgets)
      .leftJoin(dailyExpenses, eq(dailyBudgets.id, dailyExpenses.dailyBudgetId))
      .where(
        and(
          eq(dailyBudgets.accountId, accountId),
          gte(dailyBudgets.date, startDate),
          lte(dailyBudgets.date, endDate),
        ),
      )
      .orderBy(asc(dailyBudgets.date));

    return data;
  }

  // ================== MEMBERSHIP CHECK ==================

  async isUserMemberOfAccount(
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    const { members } = await import("../../database/schemas/schema.js");

    const result = await this.db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.accountId, accountId)))
      .limit(1);

    return result.length > 0;
  }
}
