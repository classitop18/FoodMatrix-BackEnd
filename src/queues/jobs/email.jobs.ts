import { emailQueue } from "../email.queue";
import {
  EmailJobType,
  PasswordResetEmailJobData,
  VerificationEmailJobData,
  WelcomeEmailJobData,
} from "../types/queue.types";

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
  to: string,
  otp: string | number,
  name?: string,
  expiresMins = 10,
) => {
  return emailQueue.add(
    "send-otp-verification",
    {
      to,
      otp,
      name,
      expiresMins,
    },
    {
      priority: 2, // Medium priority
      jobId: `otp-verification-${to}-${Date.now()}`,
    },
  );
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
