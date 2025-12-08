import IORedis, { RedisOptions } from "ioredis";
import { CONFIG } from "../../utils/env.config";
import { logger } from "../../utils/logger.utils";

const redisOptions: RedisOptions = {
  host: CONFIG.REDIS_HOST || "127.0.0.1",
  port: Number(CONFIG.REDIS_PORT || 6379),
  password: CONFIG.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

export const connection = new IORedis(redisOptions);

connection.on("connect", () => {
  logger.info("🚀 Redis connected successfully");
});

connection.on("error", (err) => {
  logger.error("❌ Redis connection error:", err);
});

connection.on("close", () => {
  logger.warn("⚠️ Redis connection closed");
});
