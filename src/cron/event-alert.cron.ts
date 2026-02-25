import cron from "node-cron";
import { getDb } from "../database/db.js";
import { events } from "../database/schemas/schema.js";
import { and, gte, lte } from "drizzle-orm";
import { logger } from "../utils/logger.utils.js";
import { notificationService } from "../modules/notifications/notifications.service.js";

/**
 * Event Alert Cron Job
 * Runs daily (9 AM) to check for:
 * 1. Events happening today
 * 2. Events happening tomorrow
 * Sends notifications to account admins for these events.
 */

class EventAlertCron {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async checkUpcomingEvents() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(todayStart);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // Up to the end of tomorrow

      // Get events happening today or tomorrow
      const upcomingEvents = await this.db
        .select({
          id: events.id,
          accountId: events.accountId,
          name: events.name,
          eventDate: events.eventDate,
          eventTime: events.eventTime,
        })
        .from(events)
        .where(
          and(
            gte(events.eventDate, todayStart),
            lte(events.eventDate, tomorrowEnd),
            // Optionally filter by status so we don't alert for cancelled events
            // eq(events.status, "planned")
          ),
        );

      logger.info(
        `Found ${upcomingEvents.length} events happening today or tomorrow`,
      );

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const event of upcomingEvents) {
        const eventDate = new Date(event.eventDate);
        eventDate.setHours(0, 0, 0, 0);

        const diffTime = eventDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let title = "";
        let body = "";

        if (diffDays === 0) {
          title = "Event Today!";
          body = `Reminder: Your event "${event.name}" is happening today.`;
        } else if (diffDays === 1) {
          title = "Upcoming Event Tomorrow!";
          body = `Reminder: Your event "${event.name}" is happening tomorrow.`;
        } else {
          continue; // Just in case
        }

        // Notify all admins/members of the account
        await notificationService.sendToAccountAdmins(event.accountId, {
          title,
          body,
          type: "EVENT_REMINDER",
          data: {
            eventId: event.id,
            eventDate: event.eventDate.toISOString(),
          },
        });

        logger.info(`Sent event reminder for: ${event.name}`);
      }
    } catch (error) {
      logger.error("Error checking upcoming events:", error);
    }
  }

  async runAlertCheck() {
    logger.info("🔔 Running event reminder check...");
    await this.checkUpcomingEvents();
    logger.info("✅ Event reminder check completed");
  }
}

const eventAlertCron = new EventAlertCron();

/**
 * Initialize the cron job
 * Schedule: Runs at 9 AM every day
 */
export function initializeEventCron() {
  cron.schedule("0 9 * * *", () => {
    eventAlertCron.runAlertCheck();
  });

  logger.info("🕐 Event reminder cron job initialized (runs at 9 AM daily)");
}

export { eventAlertCron };
