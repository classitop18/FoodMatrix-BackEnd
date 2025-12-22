import { z } from "zod";

// ============ GET INGREDIENTS QUERY ============
export const getIngredientsQuerySchema = z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    limit: z
        .string()
        .optional()
        .default("50")
        .transform((val) => Math.min(parseInt(val, 10), 200)),
});

export type GetIngredientsQuery = z.infer<typeof getIngredientsQuerySchema>;

// ============ SEARCH INGREDIENTS QUERY ============
export const searchIngredientsQuerySchema = z.object({
    q: z.string().min(1, "Search query is required"),
    limit: z
        .string()
        .optional()
        .default("20")
        .transform((val) => Math.min(parseInt(val, 10), 50)),
});

export type SearchIngredientsQuery = z.infer<typeof searchIngredientsQuerySchema>;

// ============ INGREDIENT ID PARAM ============
export const ingredientIdParamSchema = z.object({
    id: z.string().uuid("Invalid ingredient ID"),
});

export type IngredientIdParam = z.infer<typeof ingredientIdParamSchema>;

// ============ CATEGORY PARAM ============
export const categoryParamSchema = z.object({
    category: z.string().min(1, "Category is required"),
});

export type CategoryParam = z.infer<typeof categoryParamSchema>;
