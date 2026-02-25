import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js"; // Assuming your auth middleware location
import * as notificationController from "./notifications.controller.js";

const notificationRouter = Router();

// Ensure all routes are protected
notificationRouter.use(authenticate);

// Token management
notificationRouter.post(
  "/register-token",
  notificationController.registerToken,
);
notificationRouter.post(
  "/unregister-token",
  notificationController.unregisterToken,
);

// Notification Retrieval / Marking read
notificationRouter.get(
  "/history",
  notificationController.getNotificationHistory,
);
notificationRouter.get("/unread-count", notificationController.getUnreadCount);
notificationRouter.patch("/read-all", notificationController.markAllAsRead);
notificationRouter.patch("/:id/read", notificationController.markAsRead);

// Topics
notificationRouter.post(
  "/topic/subscribe",
  notificationController.subscribeToTopic,
);
notificationRouter.post(
  "/topic/unsubscribe",
  notificationController.unsubscribeFromTopic,
);

// Test Sending Route
notificationRouter.post("/send", notificationController.sendNotification);

export default notificationRouter;
