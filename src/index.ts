import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { logger } from "./utils/logger.utils";
import { CONFIG } from "./utils/env.config";
import { connectDatabase } from "./database/db";

const app = express();
const PORT = CONFIG.PORT || 3000;

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging with morgan integrated with Winston
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }),
);

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello, FoodMatrix Backend!");
});

// Example API route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack || err.message || err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// Start server
const server = app.listen(PORT, async () => {
  await connectDatabase();
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info("Shutting down server...");
  server.close(() => {
    logger.info("Server closed successfully.");
    process.exit(0);
  });
  // Force shutdown after 10s
  setTimeout(() => {
    logger.error("Forcing server shutdown.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
