import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { mealPlan } from "../../../database/schemas/schema.js";

export type MealPlan = InferSelectModel<typeof mealPlan>;
export type InsertMealPlan = InferInsertModel<typeof mealPlan>;

export interface MealPlanPaginationParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface MealPlanPaginatedResponse {
  data: MealPlan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
