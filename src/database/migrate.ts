import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  const sql = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const db = drizzle(sql);

  console.log("⏳ Running migrations...");

  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
