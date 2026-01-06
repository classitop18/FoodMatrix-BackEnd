import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../database/db.js";
import { mealPlan } from "../../database/schemas/schema.js";
import type {
  InsertMealPlan,
  MealPlan,
  MealPlanPaginationParams,
} from "./types/meal-plan.types.js";

export class MealPlanRepository {
  private _db: any = null;
   

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async getMealPlans(
    accountId: string,
    params: MealPlanPaginationParams,
  ): Promise<{ data: MealPlan[]; total: number }> {
    const { page = 1, limit = 10, startDate, endDate } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(mealPlan.accountId, accountId)];

    if (startDate) {
      conditions.push(gte(mealPlan.mealDate, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(mealPlan.mealDate, new Date(endDate)));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await this.db
      .select({ count: count() })
      .from(mealPlan)
      .where(whereClause);

    // Get paginated data
    const data = await this.db
      .select()
      .from(mealPlan)
      .where(whereClause)
      .orderBy(asc(mealPlan.mealDate))
      .limit(limit)
      .offset(offset);

    return { data, total: totalCount };
  }

  async createMealPlan(data: InsertMealPlan): Promise<MealPlan> {
    const [newMealPlan] = await this.db
      .insert(mealPlan)
      .values(data)
      .returning();
    return newMealPlan;
  }

  async updateMealPlan(
    id: string,
    updates: Partial<MealPlan>,
  ): Promise<MealPlan> {
    const [updatedItem] = await this.db
      .update(mealPlan)
      .set(updates)
      .where(eq(mealPlan.id, id))
      .returning();
    return updatedItem;
  }

  async deleteMealPlan(id: string): Promise<void> {
    await this.db.delete(mealPlan).where(eq(mealPlan.id, id));
  }
}
