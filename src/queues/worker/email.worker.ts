import { Worker, Job } from "bullmq";
import { connection } from "../config/redis.config.ts";
import { emailService, EmailService } from "../../email/email.service.ts";
import {
  EmailJobType,
  EmailResult,
  VerificationEmailJobData,
  PasswordResetEmailJobData,
  WelcomeEmailJobData,
} from "../types/queue.types.ts";
import { logger } from "../../utils/logger.utils.ts";

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

export const closeWorkerGracefully = async () => {
  logger.warn("Shutting down email worker...");
  await emailWorker.close();
  logger.info("Email worker closed");
};
