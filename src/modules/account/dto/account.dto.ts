import { z } from "zod";
import { accountTypeEnum } from "../../../common/enum-validations.js";
import { healthProfileSchema } from "../../health-profile/dto/health-profile.dto.js";

/* ---------------- CREATE ACCOUNT ---------------- */

export const createAccountSchema = z
  .object({
    accountType: accountTypeEnum,

    accountName: z
      .string()
      .min(2, "Account name must be at least 2 characters"),
    description: z.string().optional(),

    dailyBudget: z.coerce.number().optional(),
    weeklyBudget: z.coerce.number().optional(),
    monthlyBudget: z.coerce.number().optional(),

    currentAllocation: z.enum(["daily", "weekly", "monthly"]),

    groceriesPercentage: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .default(100),
    diningPercentage: z.number().int().min(0).max(100).optional().default(0),
    emergencyPercentage: z.number().int().min(0).max(100).optional().default(0),

    healthProfile: healthProfileSchema.optional(),
    formattedAddress: z.string().optional(),
    longitude: z.number().optional(),
    latitude: z.number().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    placeId: z.string().optional(),
  })
  .refine(
    (data) => {
      const g = data.groceriesPercentage ?? 100;
      const d = data.diningPercentage ?? 0;
      const e = data.emergencyPercentage ?? 0;
      return g + d + e === 100;
    },
    {
      message: "Total budget percentages must equal 100%",
      path: ["groceriesPercentage"],
    },
  );

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

/* ---------------- UPDATE ACCOUNT ---------------- */

export const updateAccountSchema = z.object({
  accountName: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  weeklyBudget: z.coerce.number().positive().optional(),
  monthlyBudget: z.coerce.number().positive().optional(),
  currentAllocation: z.enum(["weekly", "monthly"]).optional(),
  groceriesPercentage: z.number().int().min(0).max(100).optional(),
  formattedAddress: z.string().optional(),
  location: z
    .object({
      type: z.string(),
      coordinates: z.array(z.number()),
    })
    .optional(),
  longitude: z.number().optional(),
  latitude: z.number().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  placeId: z.string().optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;

/* ---------------- PARAMS ---------------- */

export const accountIdParamSchema = z.object({
  accountId: z.string().uuid("Invalid account id"),
});

export type AccountIdParamDto = z.infer<typeof accountIdParamSchema>;
