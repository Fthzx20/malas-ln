import { chapters, profiles } from '@@/server/database/schema'
import { sql, desc } from 'drizzle-orm'

export default defineCachedEventHandler(async () => {
  const db = useDB()

  // Calculate real top contributors based on published chapter translations
  const topTranslators = await db
    .select({
      translatorId: chapters.translatorId,
      contributionCount: sql<number>`count(*)`,
    })
    .from(chapters)
    .where(sql`${chapters.translatorId} is not null and ${chapters.isPublished} = true`)
    .groupBy(chapters.translatorId)
    .orderBy(desc(sql`count(*)`))
    .limit(5)

  if (topTranslators.length === 0) {
    return { contributors: [] }
  }

  // Batch-fetch profile details
  const translatorIds = topTranslators
    .map(t => t.translatorId)
    .filter((id): id is string => id !== null)

  const profileDetails = await db.query.profiles.findMany({
    where: (p, { inArray }) => inArray(p.id, translatorIds),
    columns: { id: true, username: true, displayName: true, avatarUrl: true },
  })

  const profileMap = new Map(profileDetails.map(p => [p.id, p]))

  const contributors = topTranslators
    .map(t => {
      const profile = profileMap.get(t.translatorId!)
      if (!profile) return null
      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        contributionCount: Number(t.contributionCount),
      }
    })
    .filter(Boolean)

  return { contributors }
}, {
  maxAge: 3600,       // Cache for 1 hour
  staleMaxAge: 600,   // Serve stale for 10 min
  swr: true,
})