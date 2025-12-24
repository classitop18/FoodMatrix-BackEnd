import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  like,
  lte,
  or,
} from "drizzle-orm";
import { getDb } from "../../database/db.js";
import {
  ingredients,
  pantryItems,
  pantryAlerts,
} from "../../database/schemas/schema.js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Type definitions
export type PantryItem = InferSelectModel<typeof pantryItems>;
export type InsertPantryItem = InferInsertModel<typeof pantryItems>;

export interface PantryPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  location?: string;
  sortBy?: "createdAt" | "expirationDate" | "name";
  sortOrder?: "asc" | "desc";
}

// Update interface
interface PantryItemsStorageInterface {
  getPantryItems(
    accountId: string,
    params: any,
  ): Promise<{ data: (PantryItem & { ingredient: any })[]; total: number }>;
  addPantryItem(pantryItem: InsertPantryItem): Promise<PantryItem>;
  updatePantryItem(
    pantryItemId: string,
    updates: Partial<PantryItem>,
  ): Promise<PantryItem>;
  deletePantryItem(pantryItemId: string): Promise<void>;
}

export class PantryItemsStorage implements PantryItemsStorageInterface {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async getAllPantryItems(accountId: string) {
    const today = new Date();

    const data = await this.db
      .select({
        id: pantryItems.id,
        accountId: pantryItems.accountId,
        ingredientId: pantryItems.ingredientId,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        location: pantryItems.location,
        expirationDate: pantryItems.expirationDate,
        costPaid: pantryItems.costPaid,
        addedBy: pantryItems.addedBy,
        createdAt: pantryItems.createdAt,
        updatedAt: pantryItems.updatedAt,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
          category: ingredients.category,
          averagePrice: ingredients.averagePrice,
          averageUnit: ingredients.averageUnit,
          defaultMeasurementUnit: ingredients.defaultMeasurementUnit,
          isPerishable: ingredients.isPerishable,
          shelfLifeDays: ingredients.shelfLifeDays,
          createdAt: ingredients.createdAt,
        },
      })
      .from(pantryItems)
      .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))

      .where(
        and(
          eq(pantryItems.accountId, accountId),
          or(
            isNull(pantryItems.expirationDate),
            gte(pantryItems.expirationDate, today),
          ),
        ),
      );
    return data;
  }

  async getExpiringItems(accountId: string, days: number = 7) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const data = await this.db
      .select({
        id: pantryItems.id,
        accountId: pantryItems.accountId,
        ingredientId: pantryItems.ingredientId,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        location: pantryItems.location,
        expirationDate: pantryItems.expirationDate,
        costPaid: pantryItems.costPaid,
        addedBy: pantryItems.addedBy,
        createdAt: pantryItems.createdAt,
        updatedAt: pantryItems.updatedAt,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
          category: ingredients.category,
          averagePrice: ingredients.averagePrice,
          averageUnit: ingredients.averageUnit,
          defaultMeasurementUnit: ingredients.defaultMeasurementUnit,
          isPerishable: ingredients.isPerishable,
          shelfLifeDays: ingredients.shelfLifeDays,
          createdAt: ingredients.createdAt,
        },
      })
      .from(pantryItems)
      .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
      .where(
        and(
          eq(pantryItems.accountId, accountId),
          gte(pantryItems.expirationDate, today),
          lte(pantryItems.expirationDate, futureDate),
        ),
      )
      .orderBy(asc(pantryItems.expirationDate));

    return data;
  }

  async getPantryAlerts(accountId: string) {
    const data = await this.db
      .select()
      .from(pantryAlerts)
      .where(
        and(
          eq(pantryAlerts.accountId, accountId),
          eq(pantryAlerts.isDismissed, false),
        ),
      )
      .orderBy(desc(pantryAlerts.createdAt));

    return data;
  }

  async dismissAlert(alertId: string) {
    await this.db
      .update(pantryAlerts)
      .set({ isDismissed: true, dismissedAt: new Date() })
      .where(eq(pantryAlerts.id, alertId));
  }

  async getPantryItems(
    accountId: string,
    params: any,
  ): Promise<{ data: (PantryItem & { ingredient: any })[]; total: number }> {
    const { page, limit, search, location, sortBy, sortOrder } = params;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(pantryItems.accountId, accountId)];

    if (search) {
      conditions.push(like(ingredients.name, `%${search}%`));
    }

    if (location) {
      conditions.push(eq(pantryItems.location, location));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await this.db
      .select({ count: count() })
      .from(pantryItems)
      .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
      .where(whereClause);

    // Get paginated data
    const data = await this.db
      .select({
        id: pantryItems.id,

        accountId: pantryItems.accountId,
        ingredientId: pantryItems.ingredientId,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        location: pantryItems.location,
        expirationDate: pantryItems.expirationDate,
        costPaid: pantryItems.costPaid,
        addedBy: pantryItems.addedBy,
        createdAt: pantryItems.createdAt,
        updatedAt: pantryItems.updatedAt,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
          category: ingredients.category,
          averagePrice: ingredients.averagePrice,
          averageUnit: ingredients.averageUnit,
          defaultMeasurementUnit: ingredients.defaultMeasurementUnit,
          isPerishable: ingredients.isPerishable,
          shelfLifeDays: ingredients.shelfLifeDays,
          createdAt: ingredients.createdAt,
        },
      })
      .from(pantryItems)
      .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortBy) : asc(sortBy))
      .limit(limit)
      .offset(offset);

    return { data, total: totalCount };
  }

  async addPantryItem(pantryItem: InsertPantryItem): Promise<PantryItem> {
    const [newPantryItem] = await this.db
      .insert(pantryItems)
      .values(pantryItem)
      .returning();
    return newPantryItem;
  }

  async updatePantryItem(
    pantryItemId: string,
    updates: Partial<PantryItem>,
  ): Promise<PantryItem> {
    const [updatedItem] = await this.db
      .update(pantryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pantryItems.id, pantryItemId))
      .returning();
    return updatedItem;
  }

  async deletePantryItem(pantryItemId: string): Promise<void> {
    await this.db.delete(pantryItems).where(eq(pantryItems.id, pantryItemId));
  }
}
