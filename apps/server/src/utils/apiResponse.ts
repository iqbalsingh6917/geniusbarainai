import { Response } from 'express';

// Standard success response format
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

// Standard error response format
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: any;
  };
}

// Type for our standardized responses
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Helper function to send success responses
export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    data
  } as SuccessResponse<T>);
}

// Helper function to send error responses
export function fail(
  res: Response, 
  statusCode: number, 
  code: string, 
  message: string, 
  details?: any
): Response {
  const requestId = res.locals?.requestId;
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(requestId && { requestId }),
      ...(details && { details })
    }
  } as ErrorResponse);
}
