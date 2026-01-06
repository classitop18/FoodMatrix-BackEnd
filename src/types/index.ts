export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

export type SuccessResponse<T = unknown> = ApiResponse<T>;
export type ErrorResponse = ApiResponse<null>;
