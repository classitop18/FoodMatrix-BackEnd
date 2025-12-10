import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { CONFIG } from "../utils/env.config.ts";
import * as schema from "./index.ts";
import { logger } from "../utils/logger.utils.ts";

neonConfig.webSocketConstructor = ws;

let db: NeonDatabase<typeof schema> | null = null;

export async function connectDatabase() {
  try {
    const pool = new Pool({
      connectionString: CONFIG.DATABASE_URL,
    });

    db = drizzle({ client: pool, schema });

    logger.info("🚀 Database connected successfully");
    return db;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

export function getDb(): NeonDatabase<typeof schema> {
  if (!db) {
    logger.error("❌ Database not initialized. Call connectDatabase() first.");
    throw new Error("Database not initialized. Call connectDatabase() first.");
  }
  return db;
}
