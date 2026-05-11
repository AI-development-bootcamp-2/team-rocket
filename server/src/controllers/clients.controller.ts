/**
 * HTTP handlers for the F05 /clients endpoints.
 * Role gating is split between two layers: `authenticate` runs in the route
 * file, but the admin/user *result-set* split happens here in `getClients`
 * so non-admins still get a 200 with their own scoped data instead of a 403.
 */
import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  createClientForAdmin,
  deactivateClientForAdmin,
  findClientByIdForAdmin,
  findClientByIdForUser,
  listAllClients,
  listClientsForUser,
  parseClientId,
  parseOptionalBoolean,
  parseOptionalText,
  parseRequiredText,
  toAuditClientValue,
  updateClientForAdmin,
  type ClientRow,
  type UpdateClientInput,
} from '../services/clients.service';
import { writeAuditLog } from '../services/auth.service';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

/** Returns the authenticated user attached by the auth middleware, or 401s. */
function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user;
}

/** Returns true when the authenticated user holds the admin role. */
function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

/** Maps a snake_case DB row to the camelCase API representation. */
function toClientListItem(client: ClientRow) {
  return {
    id: client.id,
    clientNumber: client.client_number,
    name: client.name,
    contactInfo: client.contact_info,
    isActive: client.is_active,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    activeProjectsCount: client.active_projects_count ?? null,
  };
}

/** GET /clients — admin gets every client, user gets only assignment-reachable active ones. */
export async function getClients(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const isActiveFilter =
    req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : null;
  const clients = isAdmin(user)
    ? await listAllClients(isActiveFilter)
    : await listClientsForUser(user.id);
  res.json({ data: clients.map(toClientListItem) });
}

/**
 * GET /clients/:id — admin can fetch any client; users only see clients
 * reachable via their active assignments. Unauthorized reads return 404
 * (not 403) so the existence of unrelated clients is not leaked.
 */
export async function getClientById(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const clientId = parseClientId(req.params.id);
  const client = isAdmin(user)
    ? await findClientByIdForAdmin(clientId)
    : await findClientByIdForUser(user.id, clientId);

  if (!client) {
    throw new AppError('Client not found', 404);
  }

  res.json(toClientListItem(client));
}

/** Returns the request IP, or '' when behind an unconfigured proxy chain. */
function extractIp(req: Request): string {
  return req.ip ?? '';
}

/** Validates and normalises the POST /clients request body. */
function parseClientCreateBody(body: Record<string, unknown>): {
  name: string;
  contactInfo: string | null | undefined;
  clientNumber: string | null | undefined;
} {
  return {
    name: parseRequiredText(body.name, 'name'),
    contactInfo: parseOptionalText(body.contact_info),
    clientNumber: parseOptionalText(body.client_number),
  };
}

/**
 * POST /clients — admin only. Returns the new client at 201. When the name
 * collides with an existing active client the response is wrapped as
 * `{ data, warning }` per spec §1; otherwise the row is returned flat to
 * match F04's createUser shape. Both success and failure paths emit a
 * CREATE audit row.
 */
export async function createClient(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const ip = extractIp(req);

  let result: Awaited<ReturnType<typeof createClientForAdmin>>;
  try {
    result = await createClientForAdmin(parseClientCreateBody(req.body as Record<string, unknown>));
  } catch (err) {
    try {
      await writeAuditLog({
        actorUserId: user.id,
        entityType: 'CLIENT',
        entityId: null,
        action: 'CREATE',
        newValue: { success: false, reason: err instanceof Error ? err.message : 'unknown' },
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.error('[audit] createClient failure:', auditErr);
    }
    throw err;
  }

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'CLIENT',
    entityId: result.client.id,
    action: 'CREATE',
    newValue: toAuditClientValue(result.client),
    ipAddress: ip,
  });

  if (result.nameDuplicate) {
    res.status(201).json({
      data: toClientListItem(result.client),
      warning: 'A client with this name already exists',
    });
    return;
  }

  res.status(201).json(toClientListItem(result.client));
}

/**
 * Validates and normalises the PUT /clients/:id body for a partial update.
 * Each field is independently optional. `name` may be omitted, but if sent
 * must be a non-empty string (the column is NOT NULL); the nullable text
 * fields use parseOptionalText so an explicit "" clears them.
 */
function parseClientUpdateBody(body: Record<string, unknown>): UpdateClientInput {
  const update: UpdateClientInput = {};
  if (body.name !== undefined) {
    update.name = parseRequiredText(body.name, 'name');
  }
  if (body.contact_info !== undefined) {
    update.contactInfo = parseOptionalText(body.contact_info);
  }
  if (body.client_number !== undefined) {
    update.clientNumber = parseOptionalText(body.client_number);
  }
  if (body.is_active !== undefined) {
    update.isActive = parseOptionalBoolean(body.is_active, 'is_active');
  }
  return update;
}

/**
 * PUT /clients/:id — admin only. Partial update; any field omitted from the
 * body is preserved. Emits an UPDATE audit row on success (with both
 * old_value and new_value) and on failure (with the error reason).
 */
export async function updateClient(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const clientId = parseClientId(req.params.id);
  const ip = extractIp(req);

  let before: ClientRow;
  let after: ClientRow;
  try {
    ({ before, after } = await updateClientForAdmin(
      clientId,
      parseClientUpdateBody(req.body as Record<string, unknown>),
    ));
  } catch (err) {
    try {
      await writeAuditLog({
        actorUserId: user.id,
        entityType: 'CLIENT',
        entityId: clientId,
        action: 'UPDATE',
        newValue: { success: false, reason: err instanceof Error ? err.message : 'unknown' },
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.error('[audit] updateClient failure:', auditErr);
    }
    throw err;
  }

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'UPDATE',
    oldValue: toAuditClientValue(before),
    newValue: toAuditClientValue(after),
    ipAddress: ip,
  });

  res.json(toClientListItem(after));
}

/**
 * DELETE /clients/:id — admin only. Soft-delete: flips is_active to false
 * and emits a DEACTIVATE audit row with the before/after diff. Returns 200
 * (not 204 like F04's user delete) because the spec requires an optional
 * `warning` body when the archived client still has active projects.
 */
export async function deactivateClient(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const clientId = parseClientId(req.params.id);
  const ip = extractIp(req);

  let result: Awaited<ReturnType<typeof deactivateClientForAdmin>>;
  try {
    result = await deactivateClientForAdmin(clientId);
  } catch (err) {
    try {
      await writeAuditLog({
        actorUserId: user.id,
        entityType: 'CLIENT',
        entityId: clientId,
        action: 'DEACTIVATE',
        newValue: { success: false, reason: err instanceof Error ? err.message : 'unknown' },
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.error('[audit] deactivateClient failure:', auditErr);
    }
    throw err;
  }

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'DEACTIVATE',
    oldValue: toAuditClientValue(result.before),
    newValue: toAuditClientValue(result.after),
    ipAddress: ip,
  });

  if (result.activeProjectCount > 0) {
    const noun = result.activeProjectCount === 1 ? 'project' : 'projects';
    res.status(200).json({
      data: toClientListItem(result.after),
      warning: `This client has ${result.activeProjectCount} active ${noun}; their tasks will no longer appear in user dropdowns.`,
    });
    return;
  }

  res.status(200).json(toClientListItem(result.after));
}
