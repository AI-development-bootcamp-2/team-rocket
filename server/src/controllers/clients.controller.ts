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
  findClientByIdForAdmin,
  findClientByIdForUser,
  listAllClients,
  listClientsForUser,
  parseClientId,
  parseOptionalText,
  parseRequiredText,
  toAuditClientValue,
  type ClientRow,
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
  };
}

/** GET /clients — admin gets every client, user gets only assignment-reachable ones. */
export async function getClients(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const clients = actor.role === 'admin' ? await listAllClients() : await listClientsForUser(actor.id);
  res.json({ data: clients.map(toClientListItem) });
}

/**
 * GET /clients/:id — admin can fetch any client; users only see clients
 * reachable via their active assignments. Unauthorized reads return 404
 * (not 403) so the existence of unrelated clients is not leaked.
 */
export async function getClientById(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const clientId = parseClientId(req.params.id);
  const client =
    actor.role === 'admin'
      ? await findClientByIdForAdmin(clientId)
      : await findClientByIdForUser(actor.id, clientId);

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
  const actor = getAuthUser(req);
  const ip = extractIp(req);

  let result: Awaited<ReturnType<typeof createClientForAdmin>>;
  try {
    result = await createClientForAdmin(parseClientCreateBody(req.body as Record<string, unknown>));
  } catch (err) {
    writeAuditLog({
      actorUserId: actor.id,
      entityType: 'CLIENT',
      entityId: null,
      action: 'CREATE',
      newValue: { success: false, reason: err instanceof Error ? err.message : 'unknown' },
      ipAddress: ip,
    }).catch((e: unknown) => console.error('[audit] createClient failure:', e));
    throw err;
  }

  await writeAuditLog({
    actorUserId: actor.id,
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
