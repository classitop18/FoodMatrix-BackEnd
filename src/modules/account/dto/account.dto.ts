import { z } from "zod";
import { accountTypeEnum } from "../../../common/enum-validations.js";
import { healthProfileSchema } from "../../health-profile/dto/health-profile.dto.js";

/* ---------------- CREATE ACCOUNT ---------------- */

export const createAccountSchema = z
  .object({
    type: accountTypeEnum,

    accountName: z
      .string()
      .min(2, "Account name must be at least 2 characters"),

    dailyBudget: z.coerce.number().positive(),
    weeklyBudget: z.coerce.number().positive(),
    monthlyBudget: z.coerce.number().positive(),
    annualBudget: z.coerce.number().positive(),

    currentAllocation: z.enum(["daily", "weekly", "monthly", "annual"]),

    groceriesPercentage: z.number().int().min(0).max(100),
    diningPercentage: z.number().int().min(0).max(100),
    emergencyPercentage: z.number().int().min(0).max(100),

    healthProfile: healthProfileSchema.optional(),
  })
  .refine(
    (data) =>
      data.groceriesPercentage +
        data.diningPercentage +
        data.emergencyPercentage ===
      100,
    {
      message: "Budget percentages must total 100%",
      path: ["groceriesPercentage"],
    },
  );

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

/* ---------------- UPDATE ACCOUNT ---------------- */

export const updateAccountSchema = z.object({
  accountName: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;

/* ---------------- PARAMS ---------------- */

export const accountIdParamSchema = z.object({
  accountId: z.string().uuid("Invalid account id"),
});

export type AccountIdParamDto = z.infer<typeof accountIdParamSchema>;
