import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { listProjectsForAdmin } from '../services/projects.service';

export async function getProjects(req: Request, res: Response): Promise<void> {
  let isActive: boolean | undefined;
  if (req.query.is_active === 'true') {
    isActive = true;
  } else if (req.query.is_active === 'false') {
    isActive = false;
  } else if (req.query.is_active != null && req.query.is_active !== '') {
    throw new AppError('is_active must be true or false', 400);
  }

  const projects = await listProjectsForAdmin({ isActive });
  res.json({
    data: projects.map((project) => ({
      id: project.id,
      name: project.name,
      isActive: project.is_active,
      clientId: project.client_id,
    })),
  });
}
