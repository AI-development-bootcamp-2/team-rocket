import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

export function wrap(fn: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}
