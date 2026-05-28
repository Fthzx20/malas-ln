import { comments } from '@@/server/database/schema'
import { createNotification, createNotificationsForUsers, extractMentions, findProfilesByUsernames } from '@@/server/utils/notifications'
import { throwApiError } from '@@/server/utils/errors'
import { purgeOnWrite } from '@@/server/utils/purge'
import { logger } from '@@/server/utils/logger'

export default defineEventHandler(async (event) => {
  const user = await checkBanned(event)

  if (!user.profileId) {
    throwApiError(400, 'Missing profileId on authenticated user', { statusCode: 400 })
  }
  const body = await readBody(event)

  if (!body.chapterId || !body.content) {
    throwApiError(400, 'chapterId and content are required')
  }

  // Validate UUID formats
  validateUUID(body.chapterId, 'chapterId')
  if (body.parentId) validateUUID(body.parentId, 'parentId')


  if (body.content.length > 5000) {
    throwApiError(400, 'Comment exceeds maximum length of 5000 characters')
  }

  // Use DB wrapper to auto-reset on connection errors and return 503
  return await withDB(async (db) => {
    try {
    const [comment] = await db
      .insert(comments)
      .values({
        userId: user.profileId,
        chapterId: body.chapterId,
        parentId: body.parentId || null,
        content: body.content,
      })
      .returning()

    if (!comment) {
      throwApiError(500, 'Failed to create comment')
    }

    // Fetch with user data
    const commentWithUser = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, comment.id),
      with: {
        user: {
          columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
        },
      },
    })

    const createdUser = commentWithUser?.user ?? null

    // Reply notification to parent comment owner
    if (body.parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: (c, { eq }) => eq(c.id, body.parentId),
        with: {
          user: {
            columns: { id: true, displayName: true, username: true, avatarUrl: true, role: true },
          },
        },
      })

      if (parentComment?.user && parentComment.user.id !== user.profileId) {
        await createNotification(db, {
          recipientId: parentComment.user.id,
          actorId: user.profileId,
          type: 'comment_reply',
          title: 'New reply on your comment',
          body: `${createdUser?.displayName || createdUser?.username || 'Someone'} replied to your chapter comment.`,
          link: `/read/${body.chapterId}`,
          entityId: comment.id,
        })
      }
    }

    // Mention notifications (@username)
    const mentionUsernames = extractMentions(body.content)
    const mentionedProfiles = await findProfilesByUsernames(db, mentionUsernames)
    const mentionNotifications = mentionedProfiles
      .filter(profile => profile.id !== user.profileId)
      .map(profile => ({
        recipientId: profile.id,
        actorId: user.profileId,
        type: 'comment_mention',
        title: 'You were mentioned in a chapter comment',
        body: `${createdUser?.displayName || createdUser?.username || 'Someone'} mentioned you in a chapter comment.`,
        link: `/read/${body.chapterId}`,
        entityId: comment.id,
      }))

    if (mentionNotifications.length > 0) {
      await createNotificationsForUsers(db, mentionNotifications)
    }

    // Purge novel cache so any novel/chapter pages reflect new comments
    try {
      const chap = await db.query.chapters.findFirst({
        where: (c, { eq }) => eq(c.id, body.chapterId),
        columns: { novelId: true },
      })
      if (chap?.novelId) await purgeOnWrite({ type: 'novelById', novelId: chap.novelId })
    } catch (e) {
      logger.warn('Failed to purge novel cache after comment create', e)
    }

      return commentWithUser
    } catch (err) {
      logger.error('[comments.create] Database error while creating comment', err)
      throwApiError(503, 'Service temporarily unavailable')
    }
  })
})
