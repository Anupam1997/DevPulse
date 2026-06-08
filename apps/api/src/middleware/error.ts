import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../lib/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    sendError(
      res,
      400,
      'ValidationError',
      first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed',
    );
    return;
  }

  console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }));
  sendError(res, 500, 'InternalServerError', 'An unexpected error occurred');
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
  ) {
    super(message);
  }
}
