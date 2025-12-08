export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
};

export type SuccessResponse<T = any> = {
  success: true;
  message: string;
  data: T;
};

export type ErrorResponse = {
  success: false;
  message: string;
  error?: any;
};
