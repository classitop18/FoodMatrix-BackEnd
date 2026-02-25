import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./database/schemas/index.js";
import { eq, desc } from "drizzle-orm";
import { CONFIG } from "./utils/env.config.js";

async function main() {
  const pool = new Pool({
    connectionString: CONFIG.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });

  const query = db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, "test-user-id"))
    .orderBy(desc(schema.notifications.sentAt))
    .limit(50);

  console.log("Raw SQL generated:");
  console.log(query.toSQL());

  pool.end();
}

main().catch(console.error);
