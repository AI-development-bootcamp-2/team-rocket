import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational = true;
  readonly extra?: Record<string, unknown>;

  constructor(message: string, statusCode: number, extra?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message, ...err.extra };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
