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

  TOKEN_EXPIRATION_MINUTES: z.string().default("60"),
  TOKEN_SECRET: z.string().min(10),

  REFRESH_TOKEN_EXPIRATION_MINUTES: z.string().default("10080"),
  REFRESH_TOKEN_SECRET: z.string().min(10),

  ACCESS_TOKEN_EXPIRY_MINUTES: z.string().default("60"),
  ACCESS_TOKEN_SECRET: z.string().min(10),

  OTP_EXPIRATION_MINUTES: z.string().default("10"),

  // -----------------------------
  // EMAIL CONFIGURATION
  // -----------------------------
  EMAIL_PROVIDER: z.enum(["smtp", "console"]).default("smtp"),

  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.string().default("587"),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),

  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(5),

  EMAIL_FROM: z.string().default("FoodMatrix <no-reply@foodmatrix.example>"),

  EMAIL_SECRET: z.string().min(10),
  FRONTEND_BASE_URL: z.string(),
  APP_URL: z.string().url(),
  PASSWORD_RESET_EXPIRATION_MINUTES: z.string(),
  PASSWORD_RESET_SECRET: z.string(),
  GOOGLE_PLACES_API_KEY:z.string(),
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
