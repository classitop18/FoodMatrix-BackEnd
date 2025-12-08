import { createLogger, format, transports } from "winston";
import path from "path";
import DailyRotateFile from "winston-daily-rotate-file";

const { combine, timestamp, printf, colorize, errors, splat } = format;

// Custom log format for console
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `[${timestamp}] ${level}: ${stack}` // show stack trace for errors
    : `[${timestamp}] ${level}: ${message}`;
});

// Daily rotating file transport (optional)
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join("logs", "%DATE%-app.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  level: "info",
  format: combine(timestamp(), format.json()),
});

export const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }), // capture stack trace
    splat(), // support printf style formatting
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }), // colorful output in console
        consoleFormat,
      ),
    }),
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(timestamp(), format.json()),
    }),
    new transports.File({
      filename: "logs/combined.log",
      format: combine(timestamp(), format.json()),
    }),
    dailyRotateTransport, // optional daily rotation
  ],
  exitOnError: false, // do not exit on handled exceptions
});
