import { Request, Response, NextFunction } from "express";
import { notificationService } from "./notifications.service.js";
import { getDb } from "../../database/db.js";
import { users, notifications } from "../../database/schemas/schema.js";
import { eq, count, and, desc } from "drizzle-orm";
import { admin } from "../../utils/firebase.js";
import { AppError } from "../../utils/app-error.utils.js";

interface AuthRequest extends Request {
  user?: { id: string; email?: string; [key: string]: any };
}

export const registerToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, device } = req.body;
    const userId = req.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);
    if (!token) throw new AppError("Token is required", 400);

    const userResult = await getDb()
      .select({ fcmTokens: users.fcmTokens })
      .from(users)
      .where(eq(users.id, userId));
    if (!userResult.length) throw new AppError("User not found", 404);

    const currentTokens = (userResult[0].fcmTokens || []) as {
      token: string;
      device: string;
      createdAt: string;
    }[];

    const tokenExists = currentTokens.some((t) => t.token === token);
    if (!tokenExists) {
      const newTokens = [
        ...currentTokens,
        {
          token,
          device: device || "Unknown Device",
          createdAt: new Date().toISOString(),
        },
      ];
      await getDb()
        .update(users)
        .set({ fcmTokens: newTokens })
        .where(eq(users.id, userId));
    }
    if (admin.apps.length > 0) {
      try {
        await admin.messaging().subscribeToTopic([token], "all_users_global");
      } catch (e) {
        console.error("Failed to subscribe to topic:", e);
      }
    }
    res.status(200).json({ message: "Token registered successfully" });
  } catch (error) {
    next(error);
  }
};

export const unregisterToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId || !token) throw new AppError("Invalid request", 400);

    const userResult = await getDb()
      .select({ fcmTokens: users.fcmTokens })
      .from(users)
      .where(eq(users.id, userId));
    if (userResult.length) {
      const currentTokens = (userResult[0].fcmTokens || []) as {
        token: string;
      }[];
      const newTokens = currentTokens.filter((t) => t.token !== token);
      await getDb()
        .update(users)
        .set({ fcmTokens: newTokens })
        .where(eq(users.id, userId));
    }

    if (admin.apps.length > 0) {
      try {
        await admin
          .messaging()
          .unsubscribeFromTopic([token], "all_users_global");
      } catch {
        /* ignore */
      }
    }

    res.status(200).json({ message: "Token unregistered globally" });
  } catch (error) {
    next(error);
  }
};

export const sendNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { targetUserId, title, body, type, data } = req.body;
    const result = await notificationService.sendToUser(targetUserId, {
      title,
      body,
      type,
      data,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getNotificationHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = (page - 1) * limit;

    const notifs = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.sentAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await getDb()
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    const total = totalResult[0]?.count || 0;

    const unreadResult = await getDb()
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    const unreadCount = unreadResult[0].count;

    res.status(200).json({
      data: notifs,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    await getDb()
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id as string),
          eq(notifications.userId, userId as string),
        ),
      );

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    await getDb()
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

export const subscribeToTopic = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, topic } = req.body;
    if (admin.apps.length > 0) {
      await admin.messaging().subscribeToTopic([token], topic);
    }
    res.status(200).json({ message: `Joined topic: ${topic}` });
  } catch (error) {
    next(error);
  }
};

export const unsubscribeFromTopic = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, topic } = req.body;
    if (admin.apps.length > 0) {
      await admin.messaging().unsubscribeFromTopic([token], topic);
    }
    res.status(200).json({ message: `Left topic: ${topic}` });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const unreadResult = await getDb()
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    const unreadCount = unreadResult[0].count;

    res.status(200).json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

export const clearAllNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    await getDb().delete(notifications).where(eq(notifications.userId, userId));

    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    next(error);
  }
};
