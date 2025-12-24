import { z } from "zod";

// ============ CREATE PANTRY ITEM ============
export const createPantryItemSchema = z
  .object({
    ingredientId: z.string().uuid("Invalid ingredient ID").optional(),
    ingredientName: z.string().optional(), // Required if ingredientId is missing
    category: z.string().optional(), // Required if ingredientId is missing (creating new)

    quantity: z.coerce.number().positive(),
    unit: z.string().min(1, "Unit is required"),
    location: z.enum(
      ["refrigerator", "freezer", "pantry", "cabinet", "countertop"],
      {
        errorMap: () => ({ message: "Invalid storage location" }),
      },
    ),
    expirationDate: z.coerce.date().optional().or(z.null()),
    costPaid: z.coerce.number().optional(),
  })
  .refine(
    (data) => data.ingredientId || (data.ingredientName && data.category),
    {
      message:
        "Either select an existing ingredient or provide name and category to create one",
      path: ["ingredientId"], // Field to attaching error to
    },
  );

export type CreatePantryItemPayload = z.infer<typeof createPantryItemSchema>;

// ============ UPDATE PANTRY ITEM ============
export const updatePantryItemSchema = z.object({
  ingredientId: z.string().uuid("Invalid ingredient ID").optional(),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.string().min(1, "Unit is required").optional(),
  location: z
    .enum(["refrigerator", "freezer", "pantry", "cabinet", "countertop"])
    .optional(),
  expirationDate: z.coerce.date().optional().or(z.null()),
  costPaid: z.number().nonnegative("Cost must be non-negative").optional(),
});

export type UpdatePantryItemPayload = z.infer<typeof updatePantryItemSchema>;

// ============ GET PANTRY ITEMS QUERY ============
// ============ GET PANTRY ITEMS QUERY ============
export const getPantryItemsQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().min(1).optional().default(1),
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().min(1).max(100).optional().default(10),
  ),
  search: z.string().optional(),
  location: z
    .enum(["refrigerator", "freezer", "pantry", "cabinet", "countertop"])
    .optional(),
  sortBy: z
    .enum(["createdAt", "expirationDate", "name"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type GetPantryItemsQuery = z.infer<typeof getPantryItemsQuerySchema>;

// ============ PANTRY ITEM ID PARAM ============
export const pantryItemIdParamSchema = z.object({
  id: z.string().uuid("Invalid pantry item ID"),
});

export type PantryItemIdParam = z.infer<typeof pantryItemIdParamSchema>;

// ============ GET EXPIRING ITEMS QUERY ============
export const getExpiringItemsQuerySchema = z.object({
  days: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().min(0).optional().default(7),
  ),
});

export type GetExpiringItemsQuery = z.infer<typeof getExpiringItemsQuerySchema>;

// ============ ALERT ID PARAM ============
export const alertIdParamSchema = z.object({
  id: z.string().uuid("Invalid alert ID"),
});

export type AlertIdParam = z.infer<typeof alertIdParamSchema>;
