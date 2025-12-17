import { users } from "@/database/schema.js";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";


export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export interface UserWithoutPassword extends Omit<User, "password" | "otp"> {}

export interface CreateUserDTO {
  email: string;
  username?: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
}

export interface UpdateUserDTO {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  formattedAddress?: string;
  latitude?: string;
  longitude?: string;
  placeId?: string;
}

export interface UpdatePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordDTO {
  newPassword: string;
}

export interface VerifyUserDTO {
  email: string;
  otp: string;
}

export interface VerifyEmailDTO {
  token: string;
}

export interface UserFilters {
  isVerified?: boolean;
  isMfaEnabled?: boolean;
  country?: string;
  state?: string;
  city?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CheckPropertyExist<T> {
  field: string;
  value: string;
}
