import { Queue, JobScheduler } from "bullmq";
import { connection } from "./config/redis.config";
import { logger } from "../utils/logger.utils";

// Initialize Queue Scheduler (handles delayed/repeated jobs)
export const emailQueueScheduler = new JobScheduler("email-queue", {
  connection,
});

// Initialize Queue
export const emailQueue = new Queue("email-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

// Queue Events
emailQueue.on("error", (error) => {
  logger.error("Queue error:", error);
});
