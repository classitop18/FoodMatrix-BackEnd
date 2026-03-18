import { getDb, connectDatabase } from "./src/database/db.js";
import { BudgetService } from "./src/modules/budget/budget.service.js";

async function run() {
  try {
    await connectDatabase();
    const s = new BudgetService();
    const db = getDb();
    const result = await db.execute(
      `SELECT  account_id FROM daily_expenses LIMIT 1`,
    );
    if (result.rows.length === 0) {
      console.log("No expenses found");
      process.exit(1);
    }
    const accountId = result.rows[0].account_id;
    console.log("Account:", accountId);

    // Fetch weekly summary
    console.log("--- WEEKLY SUMMARY ---");
    const weekly = await s.getWeeklySummary(
      accountId,
      "2026-03-18T09:00:00.000Z",
    );
    console.log(JSON.stringify(weekly, null, 2));

    console.log("--- HISTORY ---");
    const history = await s.getBudgetHistory(accountId, {});
    console.log(JSON.stringify(history, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
