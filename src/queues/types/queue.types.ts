export enum EmailJobType {
  VERIFICATION = "send-verification",
  PASSWORD_RESET = "send-password-reset",
  WELCOME = "send-welcome",
  ORDER_CONFIRMATION = "send-order-confirmation",
  INVOICE = "send-invoice",
}

export interface BaseEmailJobData {
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface VerificationEmailJobData extends BaseEmailJobData {
  to: string;
  name?: string;
  token: string;
  expiresIn?: number; // minutes
}

export interface PasswordResetEmailJobData extends BaseEmailJobData {
  resetToken: string;
  name?: string;
  expiresIn?: number;
}

export interface WelcomeEmailJobData extends BaseEmailJobData {
  userName: string;
  loginUrl?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: Date;
}
