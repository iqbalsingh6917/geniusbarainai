import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { fail } from '../utils/apiResponse';

// Custom error classes for different error types
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Central error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error caught by errorHandler:', err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return fail(
      res,
      400,
      'VALIDATION_ERROR',
      'Invalid input data',
      err.errors
    );
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        return fail(
          res,
          409,
          'CONFLICT_ERROR',
          'Resource already exists'
        );
      case 'P2025': // Record not found
        return fail(
          res,
          404,
          'NOT_FOUND_ERROR',
          'Resource not found'
        );
      default:
        return fail(
          res,
          500,
          'DATABASE_ERROR',
          'Database operation failed'
        );
    }
  }

  // Handle our custom errors
  if (err instanceof ValidationError) {
    return fail(
      res,
      400,
      'VALIDATION_ERROR',
      err.message,
      err.details
    );
  }

  if (err instanceof AuthenticationError) {
    return fail(
      res,
      401,
      'AUTHENTICATION_ERROR',
      err.message
    );
  }

  if (err instanceof AuthorizationError) {
    return fail(
      res,
      403,
      'AUTHORIZATION_ERROR',
      err.message
    );
  }

  if (err instanceof NotFoundError) {
    return fail(
      res,
      404,
      'NOT_FOUND_ERROR',
      err.message
    );
  }

  if (err instanceof ConflictError) {
    return fail(
      res,
      409,
      'CONFLICT_ERROR',
      err.message
    );
  }

  // Handle generic errors
  return fail(
    res,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred'
  );
};