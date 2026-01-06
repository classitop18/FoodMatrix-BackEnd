import cron from "node-cron";
import { getDb } from "../database/db.js";
import {
  pantryItems,
  ingredients,
  pantryAlerts,
} from "../database/schemas/schema.js";
import { and, eq, gte, lte } from "drizzle-orm";
import { logger } from "../utils/logger.utils.js";

/**
 * Pantry Alert Cron Job
 * Runs twice daily (8 AM and 6 PM) to check for:
 * 1. Items expiring within 7 days
 * 2. Items already expired
 * Creates alerts for these items if not already alerted
 */

class PantryAlertCron {
   
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async checkExpiringItems() {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Get all expiring items (within 7 days)
      const expiringItems = await this.db
        .select({
          id: pantryItems.id,
          accountId: pantryItems.accountId,
          quantity: pantryItems.quantity,
          unit: pantryItems.unit,
          expirationDate: pantryItems.expirationDate,
          ingredientName: ingredients.name,
        })
        .from(pantryItems)
        .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
        .where(
          and(
            gte(pantryItems.expirationDate, today),
            lte(pantryItems.expirationDate, sevenDaysFromNow),
          ),
        );

      logger.info(`Found ${expiringItems.length} items expiring within 7 days`);

      for (const item of expiringItems) {
        const daysUntilExpiry = Math.ceil(
          (new Date(item.expirationDate).getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // Check if alert already exists for this item
        const existingAlert = await this.db
          .select()
          .from(pantryAlerts)
          .where(
            and(
              eq(pantryAlerts.pantryItemId, item.id),
              eq(pantryAlerts.alertType, "expiring_soon"),
              eq(pantryAlerts.isDismissed, false),
            ),
          )
          .limit(1);

        if (existingAlert.length === 0) {
          const severity = daysUntilExpiry <= 3 ? "critical" : "warning";
          const message = `${item.ingredientName} (${item.quantity} ${item.unit}) expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""}`;

          await this.db.insert(pantryAlerts).values({
            accountId: item.accountId,
            pantryItemId: item.id,
            alertType: "expiring_soon",
            message,
            severity,
          });

          logger.info(`Created expiry alert for: ${item.ingredientName}`);
        }
      }
    } catch (error) {
      logger.error("Error checking expiring items:", error);
    }
  }

  async checkExpiredItems() {
    try {
      const today = new Date();

      // Get all expired items
      const expiredItems = await this.db
        .select({
          id: pantryItems.id,
          accountId: pantryItems.accountId,
          quantity: pantryItems.quantity,
          unit: pantryItems.unit,
          expirationDate: pantryItems.expirationDate,
          ingredientName: ingredients.name,
        })
        .from(pantryItems)
        .innerJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
        .where(lte(pantryItems.expirationDate, today));

      logger.info(`Found ${expiredItems.length} expired items`);

      for (const item of expiredItems) {
        // Check if alert already exists for this item
        const existingAlert = await this.db
          .select()
          .from(pantryAlerts)
          .where(
            and(
              eq(pantryAlerts.pantryItemId, item.id),
              eq(pantryAlerts.alertType, "expired"),
              eq(pantryAlerts.isDismissed, false),
            ),
          )
          .limit(1);

        if (existingAlert.length === 0) {
          const message = `${item.ingredientName} (${item.quantity} ${item.unit}) has expired!`;

          await this.db.insert(pantryAlerts).values({
            accountId: item.accountId,
            pantryItemId: item.id,
            alertType: "expired",
            message,
            severity: "critical",
          });

          logger.info(`Created expired alert for: ${item.ingredientName}`);
        }
      }
    } catch (error) {
      logger.error("Error checking expired items:", error);
    }
  }

  async runAlertCheck() {
    logger.info("🔔 Running pantry alert check...");
    await this.checkExpiringItems();
    await this.checkExpiredItems();
    logger.info("✅ Pantry alert check completed");
  }
}

const pantryAlertCron = new PantryAlertCron();

/**
 * Initialize the cron job
 * Schedule: Runs at 8 AM and 6 PM every day
 */
export function initializePantryCron() {
  // Run at 8:00 AM every day
  cron.schedule("0 8 * * *", () => {
    pantryAlertCron.runAlertCheck();
  });

  // Run at 6:00 PM every day
  cron.schedule("0 18 * * *", () => {
    pantryAlertCron.runAlertCheck();
  });

  logger.info(
    "🕐 Pantry alert cron job initialized (runs at 8 AM and 6 PM daily)",
  );
}

// Export for manual triggering if needed
export { pantryAlertCron };
