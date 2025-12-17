export const OTP_PURPOSES = {
  LOGIN_MFA: "LOGIN_MFA",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_VERIFY: "EMAIL_VERIFY",
  PHONE_VERIFY: "PHONE_VERIFY",
} as const;

export type OtpPurpose = keyof typeof OTP_PURPOSES;
