import { Request, Response } from "express";
import { logger } from "../utils/logger.utils.js";
import { sendError } from "../utils/response.utils.js";

// @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, req: Request, res: Response) => {
  logger.error(err.stack || err.message || err);

  return sendError(
    res,
    err?.message || "Internal Server Error",
    null,
    err?.status || err?.statusCode || 500,
  );
};
