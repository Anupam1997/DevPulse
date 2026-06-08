import { Response } from 'express';

export function sendError(
  res: Response,
  status: number,
  error: string,
  message: string,
): void {
  res.status(status).json({ error, message, statusCode: status });
}
