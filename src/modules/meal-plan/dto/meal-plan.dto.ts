import { z } from "zod";

export const createMealPlanSchema = z.object({
  mealDate: z.string().or(z.date()), // Accept string or date, coerce to date in service
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  // recipeId: z.string().uuid(), // Assuming strict UUID for now, maybe relax if not strict
  // recipeId is commented out in schema.ts, but let's assume valid ID is needed if we link to recipes
  // For now, based on schema.ts line 416, it is commented out.
  // But usually a meal plan needs a recipe or at least a name.
  // Schema has no 'name' field, so it MUST rely on recipeId eventually.
  // However, user pointed to line 409 where recipeId is commented out.
  // Wait, if recipeId is commented out, how do we know what the meal is?
  // Checking schema again...
  // 416:   // recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  // There is NO other field for name. This seems like a WIP schema.
  // I should probably uncomment it in my DTO or ask?
  // The user asked to "generate production grade... endpoints... ready to meal-plan related sb ready krnah".
  // If I strictly follow the schema, it's useless without a recipe link or name.
  // I will assume for now we might pass `recipeId` and I should handle it,
  // OR maybe I should check if there is a `recipes` table available to link to.
  // Actually, looking at the schema snippet provided in step 6:
  // 416:   // recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  // It IS commented out.
  // Let's look at `servings`.
  servings: z.number().min(1).default(1),
  status: z.enum(["planned", "cooked", "skipped"]).default("planned"),
});

export const updateMealPlanSchema = createMealPlanSchema.partial();

export const getMealPlansQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("10"),
});

export const mealPlanIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateMealPlanPayload = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanPayload = z.infer<typeof updateMealPlanSchema>;
export type GetMealPlansQuery = z.infer<typeof getMealPlansQuerySchema>;
