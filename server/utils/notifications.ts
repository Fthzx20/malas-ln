import { lt } from 'drizzle-orm'
import { notifications, profiles } from '@@/server/database/schema'

export type NotificationType =
  | 'comment_reply'
  | 'comment_mention'
  | 'forum_reply'
  | 'forum_mention'
  | 'chapter_update'
  | 'community_update'
  | 'system'

export interface CreateNotificationInput {
  recipientId: string
  actorId?: string | null
  type: NotificationType | string
  title: string
  body: string
  link?: string | null
  entityId?: string | null
  expiresAt?: Date | null
}

export function extractMentions(content: string) {
  const matches = content.match(/@([A-Za-z0-9_.-]+)/g) ?? []
  return [...new Set(matches.map(match => match.slice(1).toLowerCase()))]
}

export async function cleanupExpiredNotifications(db: any) {
  const now = new Date()
  await db.delete(notifications).where(lt(notifications.expiresAt, now))
}

export async function createNotification(db: any, input: CreateNotificationInput) {
  // Guard: skip if recipient is missing
  if (!input.recipientId) return null

  const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        entityId: input.entityId ?? null,
        expiresAt,
      })
      .returning()

    return notification ?? null
  } catch (err) {
    console.warn('[notifications] Failed to create notification:', err)
    return null
  }
}

const NOTIFICATION_BATCH_SIZE = 100

export async function createNotificationsForUsers(db: any, inputs: CreateNotificationInput[]) {
  // Filter out entries with missing recipientId
  const validInputs = inputs.filter(i => i.recipientId)
  if (!validInputs.length) return []

  const allCreated: any[] = []

  // Chunk inserts to prevent unbounded INSERT statements
  for (let i = 0; i < validInputs.length; i += NOTIFICATION_BATCH_SIZE) {
    const batch = validInputs.slice(i, i + NOTIFICATION_BATCH_SIZE)
    try {
      const created = await db.insert(notifications).values(batch.map(input => ({
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        entityId: input.entityId ?? null,
        expiresAt: input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }))).returning()
      allCreated.push(...created)
    } catch (err) {
      console.warn(`[notifications] Batch insert failed (offset ${i}):`, err)
    }
  }

  return allCreated
}

export async function findProfilesByUsernames(db: any, usernames: string[]) {
  if (!usernames.length) return []
  const normalized = [...new Set(usernames.map(username => username.toLowerCase()))]
  return db.query.profiles.findMany({
    where: (p, { inArray }) => inArray(p.username, normalized),
    columns: { id: true, username: true, displayName: true, avatarUrl: true },
  })
}

export async function pruneNotifications(db: any) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await db.delete(notifications).where(lt(notifications.createdAt, cutoff))
}
