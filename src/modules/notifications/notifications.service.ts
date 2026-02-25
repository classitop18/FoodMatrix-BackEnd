import { admin } from "../../utils/firebase.js";
import { getDb } from "../../database/db.js";
import {
  users,
  notifications,
  members,
} from "../../database/schemas/schema.js";
import { eq } from "drizzle-orm";

export class NotificationService {
  /**
   * Ensure all data values are strings (FCM requirement)
   */
  private stringifyData(
    data: Record<string, any> = {},
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return result;
  }

  async cleanupStaleTokens(userId: string, failedTokens: string[]) {
    if (!failedTokens || failedTokens.length === 0) return;
    try {
      const userResult = await getDb()
        .select({ fcmTokens: users.fcmTokens })
        .from(users)
        .where(eq(users.id, userId));
      if (!userResult.length || !userResult[0].fcmTokens) return;

      const currentTokens = userResult[0].fcmTokens as {
        token: string;
        device: string;
        createdAt: string;
      }[];
      const activeTokens = currentTokens.filter(
        (t) => !failedTokens.includes(t.token),
      );

      await getDb()
        .update(users)
        .set({ fcmTokens: activeTokens })
        .where(eq(users.id, userId));
      console.log(
        `Cleaned up ${failedTokens.length} stale tokens for user ${userId}`,
      );
    } catch (err) {
      console.error("Error cleaning up tokens:", err);
    }
  }

  async saveNotification(
    userId: string | null,
    title: string,
    body: string,
    type: string,
    data: any,
    accountId?: string | null,
  ) {
    try {
      const result = await getDb()
        .insert(notifications)
        .values({
          userId,
          accountId: accountId ?? null,
          title,
          body,
          type,
          data,
        })
        .returning();
      return result[0];
    } catch (err) {
      console.error("Error saving notification to DB:", err);
    }
  }

  async sendToUser(
    userId: string,
    payloadData: {
      title: string;
      body: string;
      type?: string;
      data?: any;
      accountId?: string;
    },
  ) {
    try {
      const { title, body, type = "INFO", data = {}, accountId } = payloadData;

      const userResult = await getDb()
        .select({
          fcmTokens: users.fcmTokens,
          prefs: users.notificationPreferences,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!userResult.length)
        return { success: false, message: "User not found" };

      const user = userResult[0];
      const prefs = user.prefs as { push?: boolean };

      if (prefs && prefs.push === false) {
        console.log(
          `📩 [Notification] Saved to DB only (push disabled) → user=${userId} title="${title}"`,
        );
        // Still save to DB even if push is disabled
        const savedDbData = await this.saveNotification(
          userId,
          title,
          body,
          type,
          data,
          accountId,
        );
        return {
          success: true,
          pushSkipped: true,
          dbNotificationId: savedDbData?.id,
          message: "User disabled push notifications",
        };
      }

      const tokensArr = user.fcmTokens as { token: string }[];
      const stringifiedData = this.stringifyData(data);

      const failedTokens: string[] = [];
      let response: any = null;

      if (tokensArr && tokensArr.length > 0 && admin.apps.length > 0) {
        const tokens = tokensArr.map((t) => t.token);
        console.log(
          `📤 [Notification] Sending FCM push → user=${userId} title="${title}" tokens=${tokens.length}`,
        );

        const payload = {
          notification: { title, body },
          data: stringifiedData,
          tokens,
        };

        try {
          response = await admin.messaging().sendEachForMulticast(payload);

          response.responses.forEach((resp: any, idx: number) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              if (
                errCode === "messaging/invalid-registration-token" ||
                errCode === "messaging/registration-token-not-registered"
              ) {
                failedTokens.push(tokens[idx]);
              }
            }
          });

          if (failedTokens.length > 0) {
            await this.cleanupStaleTokens(userId, failedTokens);
          }
        } catch (fcmError) {
          console.error("FCM Send Error:", fcmError);
        }
      }

      const savedDbData = await this.saveNotification(
        userId,
        title,
        body,
        type,
        data,
        accountId,
      );

      if (!tokensArr || tokensArr.length === 0) {
        console.log(
          `📩 [Notification] Saved to DB only (no FCM tokens) → user=${userId} title="${title}"`,
        );
      } else if (admin.apps.length === 0) {
        console.warn(
          `⚠️  [Notification] Saved to DB only (Firebase not initialized) → user=${userId} title="${title}"`,
        );
      } else {
        console.log(
          `✅ [Notification] Push sent + saved to DB → user=${userId} title="${title}"`,
        );
      }

      return {
        success: true,
        dbNotificationId: savedDbData?.id,
        response:
          response || "FCM not initialized or no tokens, saved to DB only",
      };
    } catch (error) {
      console.error("sendToUser error:", error);
      throw error;
    }
  }

  /**
   * Send a notification to all admins and super_admins of a specific account.
   */
  async sendToAccountAdmins(
    accountId: string,
    payloadData: { title: string; body: string; type?: string; data?: any },
  ) {
    try {
      // Find all admin/super_admin members for this account that have a linked userId
      const adminMembers = await getDb()
        .select({ userId: members.userId, role: members.role })
        .from(members)
        .where(eq(members.accountId, accountId));

      const adminUserIds = adminMembers
        .filter(
          (m) => (m.role === "admin" || m.role === "super_admin") && m.userId,
        )
        .map((m) => m.userId!);

      if (adminUserIds.length === 0) {
        console.warn(
          `⚠️  [Notification] No admin/super_admin users found for account ${accountId}`,
        );
        return { success: false, message: "No admins found for this account" };
      }

      console.log(
        `📨 [Notification] Sending to ${adminUserIds.length} admins of account ${accountId}: "${payloadData.title}"`,
      );

      const results = await Promise.allSettled(
        adminUserIds.map((userId) =>
          this.sendToUser(userId, { ...payloadData, accountId }),
        ),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return {
        success: true,
        totalAdmins: adminUserIds.length,
        succeeded,
        failed,
      };
    } catch (error) {
      console.error("sendToAccountAdmins error:", error);
      throw error;
    }
  }

  async sendToTopic(
    topic: string,
    payloadData: { title: string; body: string; type?: string; data?: any },
  ) {
    const { title, body, type = "SYSTEM", data = {} } = payloadData;
    const stringifiedData = this.stringifyData(data);
    const payload = {
      notification: { title, body },
      data: stringifiedData,
      topic,
    };

    let response: any = null;
    if (admin.apps.length > 0) {
      response = await admin.messaging().send(payload);
    }

    await this.saveNotification(null, title, body, type, data);
    return { success: true, response: response || "Saved to DB only" };
  }
}

export const notificationService = new NotificationService();
