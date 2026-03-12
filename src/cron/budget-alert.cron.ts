import cron from "node-cron";
import { getDb } from "../database/db.js";
import { dailyBudgets, dailyExpenses } from "../database/schemas/schema.js";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../utils/logger.utils.js";
import { notificationService } from "../modules/notifications/notifications.service.js";

/**
 * Budget Alert Cron Job
 * Runs daily (9 AM) to check for:
 * 1. Missing expense logs for the previous day
 * Creates alerts reminding users to sequentially log missing expenses.
 */

class BudgetAlertCron {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async checkMissingUpdates() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Find all accounts that have a budget for yesterday but no expense logged
      const missingLogs = await this.db
        .select({
          accountId: dailyBudgets.accountId,
          date: dailyBudgets.date,
        })
        .from(dailyBudgets)
        .leftJoin(
          dailyExpenses,
          eq(dailyBudgets.id, dailyExpenses.dailyBudgetId),
        )
        .where(and(eq(dailyBudgets.date, yesterday), isNull(dailyExpenses.id)));

      logger.info(
        `Found ${missingLogs.length} accounts with missing budget logs for yesterday.`,
      );

      for (const log of missingLogs) {
        const message =
          "You haven't logged your expenses for yesterday! Please log your spending to keep your budget tracking accurate.";

        await notificationService.sendToAccountAdmins(log.accountId, {
          title: "Missing Daily Budget Log",
          body: message,
          type: "BUDGET_ALERT",
        });

        logger.info(`Sent budget alert for account: ${log.accountId}`);
      }
    } catch (error) {
      logger.error("Error checking missing budget logs:", error);
    }
  }

  async runAlertCheck() {
    logger.info("🔔 Running budget missing logs check...");
    await this.checkMissingUpdates();
    logger.info("✅ Budget missing logs check completed");
  }
}

const budgetAlertCron = new BudgetAlertCron();

/**
 * Initialize the cron job
 * Schedule: Runs at 9 AM every day
 */
export function initializeBudgetCron() {
  // Run at 9:00 AM every day
  cron.schedule("0 9 * * *", () => {
    budgetAlertCron.runAlertCheck();
  });

  logger.info("🕐 Budget alert cron job initialized (runs at 9 AM daily)");
}

export { budgetAlertCron };
