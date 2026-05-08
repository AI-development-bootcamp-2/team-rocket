/**
 * HTTP handlers for the F05 /clients endpoints.
 * Role gating is split between two layers: `authenticate` runs in the route
 * file, but the admin/user *result-set* split happens here in `getClients`
 * so non-admins still get a 200 with their own scoped data instead of a 403.
 */
import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  findClientByIdForAdmin,
  findClientByIdForUser,
  listAllClients,
  listClientsForUser,
  parseClientId,
  type ClientRow,
} from '../services/clients.service';
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
