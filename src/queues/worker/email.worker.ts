import { Worker, Job } from "bullmq";
import { connection } from "../config/redis.config";
import { EmailService } from "../../email/email.service";
import {
  EmailJobType,
  EmailResult,
  VerificationEmailJobData,
  PasswordResetEmailJobData,
  WelcomeEmailJobData,
} from "../types/queue.types";
import { logger } from "../../utils/logger.utils";

const emailService = new EmailService();

const processEmailJob = async (job: Job): Promise<EmailResult> => {
  logger.info(`Processing email job: ${job.id} | Type: ${job.name}`);

  await job.updateProgress(10);

  try {
    let result: EmailResult | any;

    switch (job.name) {
      case EmailJobType.VERIFICATION: {
        const data = job.data as VerificationEmailJobData;
        result = await emailService.sendVerificationEmail(
          data.to,
          data.token,
          data?.name,
        );
        break;
      }

      case EmailJobType.PASSWORD_RESET: {
        const data = job.data as PasswordResetEmailJobData;
        result = await emailService.sendResetPasswordEmail(
          data.to,
          data.resetToken,
          data.name,
          data.expiresIn,
        );
        break;
      }

      // case EmailJobType.WELCOME: {
      //     const data = job.data as WelcomeEmailJobData;
      //     result = await emailService.sendMail(
      //         data.to,
      //         "Welcome to FoodMatrix",
      //         "welcome",
      //         { name: data.name }
      //     );
      //     break;
      // }

      // case EmailJobType.OTP: {
      //     const data = job.data as OtpEmailJobData;
      //     result = await emailService.sendOtpEmail(data.to, data.otp, data.name);
      //     break;
      // }

      // case EmailJobType.: {
      //     const data = job.data as MemberInviteJobData;
      //     result = await emailService.sendMemberInvitationEmail(
      //         data.to,
      //         data.inviteeName,
      //         data.inviterName,
      //         data.accountName,
      //         data.acceptLink
      //     );
      //     break;
      // }

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }

    await job.updateProgress(100);

    logger.info(`Email job completed | Job: ${job.id}`);
    return result;
  } catch (error: any) {
    logger.error(`Error processing email job ${job.id}: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};

export const emailWorker = new Worker("email-queue", processEmailJob, {
  connection,
  concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY || 5),
  limiter: { max: 100, duration: 60000 },
});

emailWorker.on("completed", (job) =>
  logger.info(`Job ${job.id} completed successfully`),
);
emailWorker.on("failed", (job, error) =>
  logger.error(`Job ${job?.id} failed: ${error.message}`),
);
emailWorker.on("progress", (job, progress) =>
  logger.info(`Job ${job.id} progress: ${progress}%`),
);
emailWorker.on("active", (job) =>
  logger.info(`Job ${job.id} started processing`),
);
emailWorker.on("stalled", (jobId) => logger.warn(`Job ${jobId} stalled`));
emailWorker.on("error", (error) =>
  logger.error(`Worker error: ${error.message}`),
);

export const closeWorkerGracefully = async () => {
  logger.warn("Shutting down email worker...");
  await emailWorker.close();
  logger.info("Email worker closed");
};
