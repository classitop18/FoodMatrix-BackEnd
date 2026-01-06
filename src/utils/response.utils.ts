import { Response } from "express";
import { ApiResponse } from "../types/index.js";

// Success Response
export const sendResponse = <T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } as ApiResponse<T>);
};

// Error Response
export const sendError = (
  res: Response,
  message: string = "Something went wrong",
  error: unknown = null,
  statusCode: number = 500,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  } as ApiResponse<null>);
};
