import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { writeAuditLog } from '../services/auth.service';
import {
  archiveProject,
  createProject,
  getProjectById,
  listProjects,
  updateProject,
} from '../services/projects.service';

function extractIp(req: Request): string {
  // app.ts sets trust proxy: 1, so req.ip already reflects the real client IP.
  return req.ip ?? '';
}

function toProjectResponse(p: {
  id: number;
  name: string;
  is_active: boolean;
  client_id: number;
  manager_user_id: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    isActive: p.is_active,
    clientId: p.client_id,
    managerUserId: p.manager_user_id,
    startDate: p.start_date,
    endDate: p.end_date,
    description: p.description,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function getProjects(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  let isActive: boolean | undefined;
  if (req.query.is_active === 'true') {
    isActive = true;
  } else if (req.query.is_active === 'false') {
    isActive = false;
  } else if (req.query.is_active != null && req.query.is_active !== '') {
    throw new AppError('is_active must be true or false', 400);
  }

  let clientId: number | undefined;
  if (req.query.client_id != null && req.query.client_id !== '') {
    const parsed = Number(req.query.client_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('client_id must be a positive integer', 400);
    }
    clientId = parsed;
  }

  const projects = await listProjects({
    isActive,
    clientId,
    userId: caller.role === 'user' ? caller.id : undefined,
  });

  res.json({ data: projects.map(toProjectResponse) });
}

export async function getProjectDetail(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const projectId = parseInt(req.params.id, 10);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new AppError('Invalid project id', 400);
  }

  const project = await getProjectById(
    projectId,
    caller.role === 'user' ? caller.id : undefined,
  );

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  res.json({
    data: {
      id: project.id,
      name: project.name,
      isActive: project.is_active,
      clientId: project.client_id,
      managerUserId: project.manager_user_id,
      startDate: project.start_date,
      endDate: project.end_date,
      description: project.description,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      tasks: project.tasks.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        name: t.name,
        status: t.status,
        startDate: t.start_date,
        endDate: t.end_date,
        description: t.description,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    },
  });
}

export async function createProjectHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const body = req.body as Record<string, unknown>;

  const clientId = Number(body.client_id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new AppError('client_id is required and must be a positive integer', 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new AppError('name is required', 400);

  let managerUserId: number | null = null;
  if (body.manager_user_id != null) {
    const parsed = Number(body.manager_user_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('manager_user_id must be a positive integer', 400);
    }
    managerUserId = parsed;
  }

  const { project, duplicate } = await createProject({
    clientId,
    name,
    managerUserId,
    startDate: typeof body.start_date === 'string' ? body.start_date : null,
    endDate: typeof body.end_date === 'string' ? body.end_date : null,
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
  });

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'PROJECT',
    entityId: project.id,
    action: 'CREATE',
    newValue: toProjectResponse(project) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  const responseBody: Record<string, unknown> = { data: toProjectResponse(project) };
  if (duplicate) responseBody.warning = 'פרויקט בשם זה כבר קיים תחת לקוח זה';

  res.status(201).json(responseBody);
}

export async function updateProjectHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new AppError('Invalid project id', 400);
  }

  const body = req.body as Record<string, unknown>;
  const input: Parameters<typeof updateProject>[1] = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new AppError('name cannot be empty', 400);
    input.name = name;
  }
  if (body.client_id !== undefined) {
    const clientId = Number(body.client_id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      throw new AppError('client_id must be a positive integer', 400);
    }
    input.clientId = clientId;
  }
  if ('manager_user_id' in body) {
    input.managerUserId = body.manager_user_id != null ? Number(body.manager_user_id) : null;
  }
  if ('start_date' in body) input.startDate = (body.start_date as string) ?? null;
  if ('end_date' in body) input.endDate = (body.end_date as string) ?? null;
  if ('description' in body) {
    input.description = typeof body.description === 'string' ? body.description.trim() || null : null;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') throw new AppError('is_active must be a boolean', 400);
    input.isActive = body.is_active;
  }

  const result = await updateProject(projectId, input);
  if (!result) throw new AppError('Project not found', 404);

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'PROJECT',
    entityId: projectId,
    action: 'UPDATE',
    oldValue: toProjectResponse(result.before) as unknown as Record<string, unknown>,
    newValue: toProjectResponse(result.after) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  res.json({ data: toProjectResponse(result.after) });
}

export async function archiveProjectHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new AppError('Invalid project id', 400);
  }

  const result = await archiveProject(projectId);
  if (!result) throw new AppError('Project not found', 404);

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'PROJECT',
    entityId: projectId,
    action: 'DELETE',
    oldValue: { ...toProjectResponse(result.project), isActive: true } as unknown as Record<string, unknown>,
    newValue: toProjectResponse(result.project) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  const responseBody: Record<string, unknown> = { data: toProjectResponse(result.project) };
  if (result.activeTaskCount > 0) {
    responseBody.warning = `This project has ${result.activeTaskCount} task(s) that will be hidden from user dropdowns`;
  }

  res.json(responseBody);
}
