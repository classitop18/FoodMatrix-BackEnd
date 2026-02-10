import { members } from "@/database/schemas/schema.js";
import { InferSelectModel } from "drizzle-orm";

export type Member = InferSelectModel<typeof members>;

// ============ Member with Relations ============
export interface MemberWithUser extends Member {
  user?: {
    id: string;
    email: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    phone: string | null;
  } | null;
}

export interface MemberWithAccount extends Member {
  account?: {
    id: string;
    accountNumber: string;
    accountName: string | null;
    accountType: string;
    primaryAdminId: string;
  };
}

export interface MemberWithRelations extends Member {
  user?: {
    id: string;
    email: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    phone: string | null;
  } | null;
  account?: {
    id: string;
    accountNumber: string;
    accountName: string | null;
    accountType: string;
    primaryAdminId: string;
  };
  healthProfile?: {
    id: string;
    memberId: string;
    activityLevel: string | null;
    healthScore: number | null;
    // Add other health profile fields as needed
  } | null;
}

// ============ Service Return Types ============
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface MemberStats {
  totalMembers: number;
  registeredMembers: number;
  internalMembers: number;
  membersByRole: Record<string, number>;
}

export interface MemberPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canViewHealthProfile: boolean;
  canManageMembers: boolean;
  canTransferOwnership: boolean;
}

// ============ Filter Options ============
export interface MemberFilterOptions {
  accountId?: string;
  userId?: string;
  role?: string;
  isInternal?: boolean;
  search?: string; // Search by name or email
}

export interface MemberSortOptions {
  sortBy: "createdAt" | "name" | "role";
  sortOrder: "asc" | "desc";
}

export interface MemberQueryOptions
  extends MemberFilterOptions, MemberSortOptions {
  includeHealthProfile?: boolean;
  page: number;
  limit: number;
}

// ============ Error Types ============
export class MemberError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "MemberError";
  }
}

export class MemberNotFoundError extends MemberError {
  constructor(memberId: string) {
    super(`Member with ID ${memberId} not found`, "MEMBER_NOT_FOUND", 404);
    this.name = "MemberNotFoundError";
  }
}

export class UnauthorizedMemberActionError extends MemberError {
  constructor(action: string) {
    super(`You are not authorized to ${action}`, "UNAUTHORIZED_ACTION", 403);
    this.name = "UnauthorizedMemberActionError";
  }
}

export class DuplicateMemberError extends MemberError {
  constructor(userId: string, accountId: string) {
    super(
      `User ${userId} is already a member of account ${accountId}`,
      "DUPLICATE_MEMBER",
      409,
    );
    this.name = "DuplicateMemberError";
  }
}

export class InvalidMemberDataError extends MemberError {
  constructor(message: string) {
    super(message, "INVALID_MEMBER_DATA", 400);
    this.name = "InvalidMemberDataError";
  }
}
