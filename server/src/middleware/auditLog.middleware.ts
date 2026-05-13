import { Request, Response, NextFunction, RequestHandler } from 'express';
import { writeAuditLog } from '../services/auth.service';
import type { AuditEntityType, AuditAction } from '../services/auth.service';

// Centralised IP extractor used by all controllers that write audit logs.
// req.ip is correct because app.ts sets `trust proxy 1`.
// Sliced to 45 chars — the max length of the ip_address column (IPv6 max is 45).
export function extractIpAddress(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim().slice(0, 45);
  }
  return (req.ip ?? '').slice(0, 45);
}

// Route-entity mapping: infers the entity type from the first path segment.
const PATH_ENTITY_MAP: Record<string, AuditEntityType> = {
  'time-entries': 'TIME_ENTRY',
  absences: 'ABSENCE',
  clients: 'CLIENT',
  projects: 'PROJECT',
  tasks: 'TASK',
  users: 'USER',
  assignments: 'ASSIGNMENT',
  timer: 'TIMER',
};

// Method-action mapping for generic route-level logging.
const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

// Generic audit middleware applied to mutation routes that do NOT have
// explicit service-level logging. Logs after the response is sent so it
// never delays the response. Only fires on 2xx success.
//
// NOTE: Most routes already call writeAuditLog explicitly from their service
// or controller with richer context (old/new values, entity IDs). Apply this
// middleware only to routes that lack explicit audit calls.
export function auditLogMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const action = METHOD_ACTION_MAP[req.method];
    if (!action) {
      next();
      return;
    }

    const segment = req.path.split('/').filter(Boolean)[0] ?? '';
    const entityType = PATH_ENTITY_MAP[segment];
    if (!entityType) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const result = originalJson(body);

      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const entityId =
          typeof (body as Record<string, unknown>)?.id === 'number'
            ? (body as Record<string, unknown>).id as number
            : null;

        writeAuditLog({
          actorUserId: req.user.id,
          entityType,
          entityId,
          action,
          ipAddress: extractIpAddress(req),
        }).catch((err: unknown) => console.error('[audit-middleware]', err));
      }

      return result;
    };

    next();
  };
}
