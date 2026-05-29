import { forumReplies, forumPosts } from '@@/server/database/schema'
import { eq, sql } from 'drizzle-orm'
import { requireFields, validateUUID } from '@@/server/utils/validate'
import { createNotification, createNotificationsForUsers, extractMentions, findProfilesByUsernames } from '@@/server/utils/notifications'
import { withDB } from '@@/server/utils/db'
import { purgeOnWrite } from '@@/server/utils/purge'
import { logger } from '@@/server/utils/logger'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  const user = await checkBanned(event)
  const body = await readBody(event)
  requireFields(body, ['postId', 'content'])

  // Input length limit
  if (String(body.content).length > 5000) {
    throwApiError(400, 'Reply must be 5,000 characters or fewer')
  }

  if (!user.profileId) {
    throwApiError(400, 'User profile does not exist')
  }

  validateUUID(body.postId, 'postId')

  // Use withDB for resilience
  return await withDB(async (db) => {
    // Validate target post existence and locked state
    const post = await db.query.forumPosts.findFirst({
      where: (p, { eq }) => eq(p.id, body.postId),
      columns: { id: true, isLocked: true, userId: true },
    })

    if (!post) {
      throwApiError(400, 'Post not found')
    }

    if (post.isLocked) {
      throwApiError(403, 'This thread is locked')
    }

    // Insert reply and update post reply count in a transaction
    const result = await db.transaction(async (tx) => {
    const [newReply] = await tx
      .insert(forumReplies)
      .values({
        postId: body.postId,
        content: body.content.trim(),
        userId: user.profileId,
      })
      .returning()

    if (!newReply) {
      throwApiError(500, 'Failed to create forum reply')
    }

    const replyAuthor = await tx.query.profiles.findFirst({
      where: (p, { eq }) => eq(p.id, user.profileId),
      columns: { id: true, displayName: true, username: true },
    })

    if (post.userId !== user.profileId) {
      await createNotification(tx, {
        recipientId: post.userId,
        actorId: user.profileId,
        type: 'forum_reply',
        title: 'New reply in community thread',
        body: `${replyAuthor?.displayName || replyAuthor?.username || 'Someone'} replied to your thread.`,
        link: `/community/post/${post.id}`,
        entityId: newReply.id,
      })
    }

    const mentionUsernames = extractMentions(body.content)
    const mentionedProfiles = await findProfilesByUsernames(tx, mentionUsernames)
    await createNotificationsForUsers(tx, mentionedProfiles
      .filter((profile: any) => profile.id !== user.profileId)
      .map((profile: any) => ({
        recipientId: profile.id,
        actorId: user.profileId,
        type: 'forum_mention',
        title: 'You were mentioned in a community reply',
        body: `${replyAuthor?.displayName || replyAuthor?.username || 'Someone'} mentioned you in a community reply.`,
        link: `/community/post/${post.id}`,
        entityId: newReply.id,
      })))

    // Increment reply count on the post
    await tx
      .update(forumPosts)
      .set({
        replyCount: sql`${forumPosts.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(forumPosts.id, body.postId))

      return newReply
    })
    // Best-effort purge of forum caches so thread lists reflect new replies
    try {
      await purgeOnWrite({ type: 'forum' })
    } catch (e) {
      logger.warn('Failed to purge forum cache after reply creation', e)
    }

    return result
  })
})
