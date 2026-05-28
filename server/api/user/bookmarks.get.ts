import { bookmarks } from '@@/server/database/schema'
import { throwApiError } from '@@/server/utils/errors'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  console.info('[api] bookmarks GET start')
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }
  console.info('[api] bookmarks GET after requireAuth')
  const db = useDB()

  const query = getQuery(event)
  const status = query.status as string | undefined

  if (!user.profileId) {
    throwApiError(400, 'User profile not found')
  }

  const conditions = [eq(bookmarks.userId, user.profileId)]
  if (status) {
    conditions.push(eq(bookmarks.status, status as any))
  }

  const userBookmarks = await db.query.bookmarks.findMany({
    where: and(...conditions),
    with: {
      novel: {
        columns: {
          id: true,
          slug: true,
          title: true,
          coverUrl: true,
          author: true,
          status: true,
          totalChapters: true,
        },
      },
      currentChapter: {
        columns: { id: true, chapterNumber: true, title: true },
      },
    },
    orderBy: (b, { desc }) => [desc(b.updatedAt)],
  })

  console.info('[api] bookmarks GET DB queries complete')

  return userBookmarks
})
