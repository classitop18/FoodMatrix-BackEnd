import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./index.js";
import { CONFIG } from "../utils/env.config.js";
import { logger } from "../utils/logger.utils.js";

let db: NodePgDatabase<typeof schema> | null = null;

export async function connectDatabase() {
  try {
    const pool = new Pool({
      connectionString: CONFIG.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // important for Neon
    });

    db = drizzle(pool, { schema });

    logger.info("🚀 Database connected successfully");
    return db;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    throw new Error("Database not initialized. Call connectDatabase() first.");
  }
  return db;
}
