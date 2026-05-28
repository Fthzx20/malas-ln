export async function purgeNovelsCache(): Promise<void> {
  const storage = useStorage('cache')
  // Nitro prefixes handler cache keys with "nitro:handlers:"
  const keys = await storage.getKeys('nitro:handlers:')
  const novelKeys = keys.filter(k =>
    k.includes('novels:list') || k.includes('novels:featured')
  )
  await Promise.all(novelKeys.map(k => storage.removeItem(k)))
}

export async function purgeNovelSlugCache(slug: string): Promise<void> {
  const storage = useStorage('cache')
  const keys = await storage.getKeys('nitro:handlers:')
  const slugKeys = keys.filter(k => k.includes(`novels:${slug}`))
  await Promise.all(slugKeys.map(k => storage.removeItem(k)))
}
