import { chapters, footnotes } from '@@/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateUUID } from '@@/server/utils/validate'
import { throwApiError } from '@@/server/utils/errors'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwApiError(400, 'Chapter ID is required')
  }
  validateUUID(id, 'Chapter ID')

  const db = useDB()

  const chapter = await db.query.chapters.findFirst({
    where: (c, { eq }) => eq(c.id, id),
    with: {
      novel: {
        columns: { id: true, slug: true, title: true, coverUrl: true },
      },
      volume: {
        columns: { id: true, volumeNumber: true, title: true },
      },
      translator: {
        columns: { id: true, displayName: true, username: true },
      },
      footnotes: {
        orderBy: (fn, { asc }) => [asc(fn.positionIndex)],
      },
    },
  })

  if (!chapter) {
    throwApiError(404, 'Chapter not found')
  }

  // If chapter is not published, verify user role is authorized
  if (!chapter.isPublished) {
    await requireRole(event, 'translator', 'admin')
  }

  // Get prev/next chapter IDs for navigation
  const [prevChapter, nextChapter] = await Promise.all([
    db.query.chapters.findFirst({
      where: (c, { eq, and, lt }) => and(
        eq(c.novelId, chapter.novelId),
        eq(c.isPublished, true),
        lt(c.chapterNumber, chapter.chapterNumber),
      ),
      orderBy: (c, { desc }) => [desc(c.chapterNumber)],
      columns: { id: true, chapterNumber: true, title: true },
    }),
    db.query.chapters.findFirst({
      where: (c, { eq, and, gt }) => and(
        eq(c.novelId, chapter.novelId),
        eq(c.isPublished, true),
        gt(c.chapterNumber, chapter.chapterNumber),
      ),
      orderBy: (c, { asc }) => [asc(c.chapterNumber)],
      columns: { id: true, chapterNumber: true, title: true },
    }),
  ])

  return {
    chapter,
    navigation: {
      prev: prevChapter || null,
      next: nextChapter || null,
    },
  }
})
