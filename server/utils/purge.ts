import { purgeNovelsCache, purgeNovelSlugCache } from './cache'
import { withDB } from './db'
import { logger } from './logger'

type PurgeOpts = {
  type: 'novel' | 'novelById' | 'novelSlug' | 'chapter' | 'forum' | 'forumCategory'
  novelId?: string
  slug?: string
}

export async function purgeOnWrite(opts: PurgeOpts): Promise<void> {
  try {
    if (opts.type === 'novel') {
      await purgeNovelsCache()
      return
    }

    if (opts.type === 'novelSlug' && opts.slug) {
      await purgeNovelSlugCache(opts.slug)
      return
    }

    if (opts.type === 'novelById' && opts.novelId) {
      // Lookup slug from DB then purge slug cache
      await withDB(async (db) => {
        const nid = opts.novelId as string
        const novel = await db.query.novels.findFirst({
          where: (n, { eq }) => eq(n.id, nid),
          columns: { slug: true },
        })
        if (novel?.slug) {
          await purgeNovelSlugCache(novel.slug)
        }
      })
      return
    }

    if (opts.type === 'chapter' && opts.novelId) {
      // Chapter writes generally affect the parent novel page
      await purgeOnWrite({ type: 'novelById', novelId: opts.novelId })
      return
    }
    if (opts.type === 'forum') {
      const storage = useStorage('cache')
      const keys = await storage.getKeys('nitro:handlers:')
      const forumKeys = keys.filter(k => k.includes('forum') || k.includes('community') || k.includes('posts'))
      await Promise.all(forumKeys.map(k => storage.removeItem(k)))
      return
    }

    if (opts.type === 'forumCategory' && opts.slug) {
      const storage = useStorage('cache')
      const keys = await storage.getKeys('nitro:handlers:')
      const catKeys = keys.filter(k => k.includes(`forum:${opts.slug}`) || k.includes(`community:${opts.slug}`))
      await Promise.all(catKeys.map(k => storage.removeItem(k)))
      return
    }
  } catch (e) {
    // Non-fatal: log and continue
    logger.warn('purgeOnWrite failed', e)
  }
}
