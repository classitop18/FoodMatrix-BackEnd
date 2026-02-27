import { connectDatabase, getDb } from "./src/database/db.js";
import { receipts } from "./src/database/schemas/receipts.js";

async function run() {
  await connectDatabase();
  const db = getDb();
  const res = await db.select().from(receipts).limit(5);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
run().catch(console.error);
