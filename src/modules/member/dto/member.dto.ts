import { z } from "zod";

// ============ Enums ============
export const MemberRole = z.enum(["admin", "super_admin", "member"]);
export const Sex = z.enum(["male", "female", "other"]);

// ============ Create Member DTO ============
export const createMemberSchema = z
  .object({
    accountId: z.string().uuid("Invalid account ID"),
    userId: z.string().uuid("Invalid user ID").optional().nullable(),
    role: MemberRole.default("member"),
    name: z.string().min(1, "Name is required for internal members").optional(),
    age: z.number().int().min(0).max(150).optional().nullable(),
    sex: Sex.optional().nullable(),
    avatar: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // If userId is null/undefined, name must be provided (internal member)
      if (!data.userId && !data.name) {
        return false;
      }
      return true;
    },
    {
      message:
        "Name is required for internal members (when userId is not provided)",
      path: ["name"],
    },
  );

export type CreateMemberDto = z.infer<typeof createMemberSchema>;

// ============ Update Member DTO ============
export const updateMemberSchema = z
  .object({
    role: MemberRole.optional(),
    name: z.string().min(1).optional(),
    age: z.number().int().min(0).max(150).optional().nullable(),
    sex: Sex.optional().nullable(),
    avatar: z.string().optional().nullable(),
  })
  .strict();

export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;

// ============ Query/Filter DTO ============
export const getMembersQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  role: MemberRole.optional(),
  isInternal: z.boolean().optional(), // Filter internal vs registered members
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["createdAt", "name", "role"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeHealthProfile: z.coerce.boolean().optional(),
});

export type GetMembersQueryDto = z.infer<typeof getMembersQuerySchema>;

// ============ Response DTOs ============
export const memberResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  role: MemberRole,
  name: z.string().nullable(),
  age: z.number().nullable(),
  sex: Sex.nullable(),
  avatar: z.string().nullable().optional(),
  createdAt: z.date(),
  // Populated fields (optional)
  user: z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
      username: z.string().nullable(),
      firstName: z.string(),
      lastName: z.string().nullable(),
      avatar: z.string().nullable(),
    })
    .optional(),
  account: z
    .object({
      id: z.string().uuid(),
      accountNumber: z.string(),
      accountName: z.string().nullable(),
      accountType: z.string(),
    })
    .optional(),
  healthProfile: z
    .object({
      id: z.string().uuid(),
      dietaryRestrictions: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      healthConditions: z.array(z.string()).optional(),
      // Add other fields as needed for the UI
    })
    .optional()
    .nullable(),
});

export type MemberResponseDto = z.infer<typeof memberResponseSchema>;

export const paginatedMembersResponseSchema = z.object({
  data: z.array(memberResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type PaginatedMembersResponseDto = z.infer<
  typeof paginatedMembersResponseSchema
>;

// ============ Transfer Ownership DTO ============
export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid("Invalid member ID"),
});

export type TransferOwnershipDto = z.infer<typeof transferOwnershipSchema>;

// ============ Bulk Operations DTO ============
export const bulkUpdateRoleSchema = z.object({
  memberIds: z
    .array(z.string().uuid())
    .min(1, "At least one member ID is required"),
  role: MemberRole,
});

export type BulkUpdateRoleDto = z.infer<typeof bulkUpdateRoleSchema>;

export const bulkDeleteMembersSchema = z.object({
  memberIds: z
    .array(z.string().uuid())
    .min(1, "At least one member ID is required"),
});

export type BulkDeleteMembersDto = z.infer<typeof bulkDeleteMembersSchema>;
