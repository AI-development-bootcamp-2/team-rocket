import type { Knex } from 'knex';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export type NotificationType =
  | 'WEEK_REJECTED'
  | 'MISSING_REPORT'
  | 'ADMIN_EDIT'
  | 'LOCKED_MONTH'
  | 'QUOTA_WARNING';

export interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await db('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    related_entity_type: params.relatedEntityType ?? null,
    related_entity_id: params.relatedEntityId ?? null,
  });
}
