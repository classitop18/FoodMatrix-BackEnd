import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schemas/index.js";
import { CONFIG } from "../utils/env.config.js";
import { logger } from "../utils/logger.utils.js";

// Node.js environment mein WebSocket polyfill chahiye
neonConfig.webSocketConstructor = ws;

let db: NeonDatabase<typeof schema> | null = null;

export async function connectDatabase() {
  try {
    const pool = new Pool({ connectionString: CONFIG.DATABASE_URL });
    db = drizzle(pool, { schema });

    // Connection test
    await pool.query("SELECT 1");

    logger.info("🚀 Database connected successfully");
    return db;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

export function getDb(): NeonDatabase<typeof schema> {
  if (!db) {
    throw new Error("Database not initialized. Call connectDatabase() first.");
  }
  return db;
}
