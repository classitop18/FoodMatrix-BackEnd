import { InferSelectModel } from "drizzle-orm";
import { userOtps } from "../../../database";

export interface CreateOtpDTO {
  userId: string;
  otp: string;
  purpose: string;
  expiresAt: Date;
  tempSessionToken?: string | null;
}

export interface VerifyOtpDTO {
  userId: string;
  otp: string;
  purpose: string;
}

export interface MarkOtpUsedDTO {
  id: string;
}

export type UserOtp = InferSelectModel<typeof userOtps>;

export type UserOtpInsert = Omit<
  UserOtp,
  "id" | "createdAt" | "used" | "usedAt"
>;
