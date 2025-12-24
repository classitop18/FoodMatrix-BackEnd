import { asc, eq, ilike } from "drizzle-orm";
import { getDb } from "../../database/db.js";
import { ingredients } from "../../database/schemas/schema.js";

export interface IngredientsQueryParams {
  category?: string;
  search?: string;
  limit?: number;
}

export class IngredientsRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async getAllIngredients(params: IngredientsQueryParams) {
    const { category, search, limit = 50 } = params;

    let query = this.db.select().from(ingredients);

    if (category) {
      query = query.where(ilike(ingredients.category, category)) as any;
    }

    if (search) {
      query = query.where(ilike(ingredients.name, `%${search}%`)) as any;
    }

    const result = await query.orderBy(asc(ingredients.name)).limit(limit);
    return result;
  }

  async getIngredientById(id: string) {
    const [ingredient] = await this.db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);

    return ingredient || null;
  }

  async getCategories(): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ category: ingredients.category })
      .from(ingredients)
      .orderBy(asc(ingredients.category));

    return result.map((r: { category: string }) => r.category);
  }

  async searchIngredients(query: string, limit: number = 20) {
    const result = await this.db
      .select()
      .from(ingredients)
      .where(ilike(ingredients.name, `%${query}%`))
      .orderBy(asc(ingredients.name))
      .limit(limit);

    return result;
  }

  async getByCategory(category: string) {
    const result = await this.db
      .select()
      .from(ingredients)
      .where(ilike(ingredients.category, category))
      .orderBy(asc(ingredients.name));

    return result;
  }

  async findByName(name: string) {
    const [ingredient] = await this.db
      .select()
      .from(ingredients)
      .where(ilike(ingredients.name, name))
      .limit(1);
    return ingredient || null;
  }

  async createIngredient(data: {
    name: string;
    category: string;
    defaultMeasurementUnit?: string;
  }) {
    const [newIngredient] = await this.db
      .insert(ingredients)
      .values({
        name: data.name,
        category: data.category,
        defaultMeasurementUnit: data.defaultMeasurementUnit,
      })
      .returning();
    return newIngredient;
  }
}
