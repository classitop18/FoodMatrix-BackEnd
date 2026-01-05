import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { logger } from "./utils/logger.utils.js";
import { CONFIG } from "./utils/env.config.js";
import { connectDatabase } from "./database/db.js";
import appRouter from "./routes/index.js";
import { sendError } from "./utils/response.utils.js";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { emailQueue } from "./queues/email.queue.js";
import { emailWorker } from "./queues/worker/email.worker.js";
import cookieParser from "cookie-parser";
import { initializePantryCron } from "./cron/pantry-alert.cron.js";
import { config } from "dotenv";
import path from "path";
config(); // Load .env variables
const app = express();
const PORT = CONFIG.PORT || 3000;

// Security middlewares
app.use(helmet());
// ||  process.env.CORS_ORIGINS?.split(",") || [];

const allowedOrigins =["http://localhost:3001","http://localhost:3000","https://app.example.com" ,"localhost"] 

logger.info("Allowed origins: ", allowedOrigins);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      logger.info("Origin: ", origin);

      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



// HTTP request logging with morgan integrated with Winston
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }),
);

// Serve static files (uploads)
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads")),
);


// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello, FoodMatrix Backend!");
});

// Example API route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.use("/api", appRouter);
app.use("/api/v1", appRouter);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack || err.message || err);

  return sendError(
    res,
    err?.message || "Internal Server Error",
    null,
    err?.status || 500,
  );
});

// Start server
const server = app.listen(PORT, async () => {
  await connectDatabase();
  logger.info(`Server is running on port ${PORT}`);

  // Initialize pantry alert cron job
  initializePantryCron();

  emailWorker.on("completed", (job) =>
    logger.info(`Job ${job.id} completed successfully`),
  );
  emailWorker.on("failed", (job, error) =>
    logger.error(`Job ${job?.id} failed: ${error.message}`),
  );
  emailWorker.on("progress", (job, progress) =>
    logger.info(`Job ${job.id} progress: ${progress}%`),
  );
  emailWorker.on("active", (job) =>
    logger.info(`Job ${job.id} started processing`),
  );
  emailWorker.on("stalled", (jobId) => logger.warn(`Job ${jobId} stalled`));
  emailWorker.on("error", (error) =>
    logger.error(`Worker error: ${error.message}`),
  );
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
