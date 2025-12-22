import { ErrorResponse, SuccessResponse } from "@/types/index.js";
import { Response } from "express";

// Success
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200,
) => {
  return res
    .status(statusCode)
    .json({ success: true, message, data } as SuccessResponse<T>);
};

// Error
export const sendError = (
  res: Response,
  message: string = "Something went wrong",
  error?: any,
  statusCode: number = 500,
) => {
  return res
    .status(statusCode)
    .json({ success: false, message, error } as ErrorResponse);
};
