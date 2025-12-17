import { emailQueue } from "../email.queue.js";
import { EmailJobType, OtpVerificationEmailJobData, PasswordResetEmailJobData, VerificationEmailJobData, WelcomeEmailJobData } from "../types/queue.types.js";


export const addVerificationEmailJob = async (
  data: VerificationEmailJobData,
) => {
  return emailQueue.add(EmailJobType.VERIFICATION, data, {
    priority: 1, // High priority
    jobId: `verification-${data.to}-${Date.now()}`,
  });
};

export const addPasswordResetEmailJob = async (
  data: PasswordResetEmailJobData,
) => {
  return emailQueue.add(EmailJobType.PASSWORD_RESET, data, {
    priority: 1, // High priority
    jobId: `password-reset-${data.to}-${Date.now()}`,
  });
};

export const addWelcomeEmailJob = async (data: WelcomeEmailJobData) => {
  return emailQueue.add(EmailJobType.WELCOME, data, {
    priority: 3, // Normal priority
    delay: 5000, // Send after 5 seconds
  });
};

export const addOtpVerificationEmailJob = async (
  payload: OtpVerificationEmailJobData,
) => {
  return emailQueue.add(EmailJobType.OTP_VERIFICATION, payload, {
    priority: 2,
    jobId: `otp-verification-${payload?.to}-${Date.now()}`,
  });
};
export const addMemberInvitationEmailJob = async (
  to: string,
  inviteeName: string,
  inviterName: string,
  accountName: string,
  acceptLink: string,
) => {
  return emailQueue.add(
    "send-member-invitation",
    {
      to,
      inviteeName,
      inviterName,
      accountName,
      acceptLink,
    },
    {
      priority: 2, // Medium priority
      jobId: `member-invitation-${to}-${Date.now()}`,
    },
  );
};
