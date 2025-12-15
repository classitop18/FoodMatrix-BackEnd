import { z } from "zod";

/* ---------------- CREATE ACCOUNT ---------------- */

export const createAccountSchema = z.object({
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  description: z.string().optional(),
});

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
