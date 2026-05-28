import { forumPosts } from '@@/server/database/schema'
import { validateUUID } from '@@/server/utils/validate'
import { withDB } from '@@/server/utils/db'
import { throwApiError } from '@@/server/utils/errors'
import { purgeOnWrite } from '@@/server/utils/purge'

export default defineEventHandler(async (event) => {
  const user = await checkBanned(event)
  const body = await readBody(event)

  if (!body.title || !body.content || !body.categoryId) {
    throwApiError(400, 'Title, content, and categoryId are required')
  }

  // Input length limits
  const title = String(body.title).trim()
  const content = String(body.content).trim()

  if (title.length > 200) {
    throwApiError(400, 'Title must be 200 characters or fewer')
  }
  if (content.length > 10000) {
    throwApiError(400, 'Content must be 10,000 characters or fewer')
  }

  // Use withDB for resilience
  return await withDB(async (db) => {
  if (!user.profileId) {
    throwApiError(400, 'User profile does not exist')
  }

  // Validate category exists
  const category = await db.query.forumCategories.findFirst({
    where: (c, { eq }) => eq(c.id, body.categoryId),
    columns: { id: true },
  })

  if (!category) {
    throwApiError(400, 'Forum category not found')
  }

    validateUUID(body.categoryId, 'categoryId')

    const [newPost] = await db
      .insert(forumPosts)
      .values({
        title,
        content,
        categoryId: body.categoryId,
        userId: user.profileId,
      })
      .returning()

  // NOTE: Mass notification to ALL users was removed — it caused catastrophic
  // N+1 insert storms at scale. Notifications for new forum posts should be
  // handled by a subscription/follow system or background job, not inline.

    if (!newPost) {
      throwApiError(500, 'Failed to create forum post')
    }

    // Best-effort purge of forum caches so lists reflect new posts
    try {
      await purgeOnWrite({ type: 'forum' })
    } catch (e) {
      console.warn('Failed to purge forum cache after post creation', e)
    }

    return newPost
  })
})
