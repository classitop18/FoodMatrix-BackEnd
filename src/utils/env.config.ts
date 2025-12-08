import { config } from "dotenv";
import { z } from "zod";

config(); // Load .env variables

// Define all required environment variables schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_PORT: z.string().default("6379"),
  TOKEN_EXPIRATION_MINUTES: z.string().default("60"), // 24 hours
  TOKEN_SECRET: z.string().min(10),
});

// Parse + validate
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid or missing environment variables:\n");
  console.table(_env.error.format());
  process.exit(1); // stop server until fixed
}

// Export fully typed config
export const CONFIG = _env.data;
