import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is missing!')
  process.exit(1)
}

// Safety guard: never run seeding in production and require explicit confirmation
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run seed in production environment')
  process.exit(1)
}
if (process.env.CONFIRM_SEED !== 'true') {
  console.error('Refusing to run seed: set CONFIRM_SEED=true to proceed')
  process.exit(1)
}

const client = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(client, { schema })

async function main() {
  console.log('--- START SEEDING ---')

  // 1. Clean existing tables (in order of dependencies)
  console.log('Cleaning existing table data...')
  await db.delete(schema.readingHistory)
  await db.delete(schema.reports)
  await db.delete(schema.forumReplies)
  await db.delete(schema.forumPosts)
  await db.delete(schema.forumCategories)
  await db.delete(schema.comments)
  await db.delete(schema.ratings)
  await db.delete(schema.bookmarks)
  await db.delete(schema.footnotes)
  await db.delete(schema.chapters)
  await db.delete(schema.volumes)
  await db.delete(schema.novels)
  await db.delete(schema.profiles)

  // 2. Seed profiles
  console.log('Seeding profiles...')
  const mockProfiles = [
    {
      id: 'd8c728e5-3642-4b78-9e67-d8120fa22511',
      authId: 'd8c728e5-3642-4b78-9e67-d8120fa22511',
      username: 'admin',
      displayName: 'Editorial Director',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Managing editor and chief publisher at Rano LN.',
      role: 'admin' as const,
      readingStats: JSON.stringify({ wordsRead: 154000, chaptersRead: 75, novelsCompleted: 2 }),
      isBanned: false,
    },
    {
      id: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      authId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      username: 'translator_zero',
      displayName: 'Translator Zero',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Fan translator focused on historical and psychological serials.',
      role: 'translator' as const,
      readingStats: JSON.stringify({ wordsRead: 98000, chaptersRead: 40, novelsCompleted: 1 }),
      isBanned: false,
    },
    {
      id: 'fa270cf7-5221-4d33-a6fe-6e6ad9d2243d',
      authId: 'fa270cf7-5221-4d33-a6fe-6e6ad9d2243d',
      username: 'lightnovel_fan',
      displayName: 'Alice Carter',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Avid reader and enthusiast of fantasy serials.',
      role: 'user' as const,
      readingStats: JSON.stringify({ wordsRead: 254000, chaptersRead: 120, novelsCompleted: 4 }),
      isBanned: false,
    }
  ]

  const seededProfiles = await db.insert(schema.profiles).values(mockProfiles).returning()
  console.log(`Seeded ${seededProfiles.length} profiles.`)

  // 3. Seed novels
  console.log('Seeding novels...')
  const mockNovels = [
    {
      id: '50e261bd-8c4d-44b2-b5e1-88404a3adbc4',
      slug: 'chronicles-of-the-abyss',
      title: 'Chronicles of the Dark Abyss',
      originalTitle: '深淵の記録 (Shinyen no Kiroku)',
      synopsis: 'Deep in the subterranean labyrinth beneath the imperial capital lies the dark abyss, a place of forbidden sorcery and forgotten gods. When a disgraced scholar is exiled to the deepest layer, he discovers a secrets that could shatter the empire.',
      coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=800&q=80',
      author: 'Kusanagi Ryousuke',
      illustrator: 'Nakamura Hina',
      publisher: 'Newsprint Bunko',
      year: 2024,
      status: 'ongoing' as const,
      genreTags: ['Fantasy', 'Adventure', 'Mystery', 'Psychological'],
      taxonomyTags: ['Labyrinth', 'Anti-Hero', 'Forbidden Magic', 'Political Intrigue'],
      totalChapters: 3,
      totalWords: 7500,
      avgRating: 4.8,
      ratingCount: 15,
      isFeatured: true,
    },
    {
      id: '86fe62df-ca52-47ef-8d62-c07a3c3065b2',
      slug: 'resonance-of-tomorrow',
      title: 'Resonance of Tomorrow',
      originalTitle: '明日の共鳴 (Ashita no Kyoumei)',
      synopsis: 'In a neo-tokyo dominated by algorithmic neural networks, a sound engineer intercepts a mysterious melody that is playing synchronously in the minds of thousands of sleeping citizens. To trace its origin, she must dive deep into the outlawed cyberspace.',
      coverUrl: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?auto=format&fit=crop&w=600&h=800&q=80',
      author: 'Tachibana Yuto',
      illustrator: 'Sato Ken',
      publisher: 'Nova Editorial',
      year: 2025,
      status: 'ongoing' as const,
      genreTags: ['Sci-Fi', 'Drama', 'Psychological'],
      taxonomyTags: ['Cyberpunk', 'Hacking', 'Acoustics', 'Artificial Intelligence'],
      totalChapters: 2,
      totalWords: 4500,
      avgRating: 4.5,
      ratingCount: 10,
      isFeatured: true,
    },
    {
      id: 'b5beccf9-f79a-4c28-98e3-54cd916c52bb',
      slug: 'silent-summer-memories',
      title: 'Our Silent Summer Memories',
      originalTitle: '静かな夏への追伸 (Shizukana Natsu e no Tsuishin)',
      synopsis: 'After leaving the countryside, Jun returns to his seaside hometown for the first time in five years. There he meets an enigmatic girl who only writes letters using a typewriter from the 1970s. A melancholic story of youth, lost dreams, and letters left unsent.',
      coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&h=800&q=80',
      author: 'Miyazaki Haruki',
      illustrator: 'Shimizu Mai',
      publisher: 'Tsubaki Publishing',
      year: 2023,
      status: 'completed' as const,
      genreTags: ['Romance', 'Slice of Life', 'Drama'],
      taxonomyTags: ['Tragedy', 'Nostalgia', 'Seaside Town', 'Letters'],
      totalChapters: 2,
      totalWords: 5200,
      avgRating: 4.2,
      ratingCount: 8,
      isFeatured: false,
    }
  ]

  const seededNovels = await db.insert(schema.novels).values(mockNovels).returning()
  console.log(`Seeded ${seededNovels.length} novels.`)

  // 4. Seed volumes
  console.log('Seeding volumes...')
  const mockVolumes = [
    {
      id: 'e48a12e2-63f2-4e8c-85a2-094ee128fcbb',
      novelId: '50e261bd-8c4d-44b2-b5e1-88404a3adbc4', // Abyss
      volumeNumber: 1,
      title: 'Vol 1: The Exiled Scholar',
      coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=800&q=80',
      synopsis: 'The scholar Raymond is convicted of reading forbidden texts and cast into the Labyrinth of the Abyss.',
    },
    {
      id: 'fa27ef9a-4c28-98e3-54cd-916c52bba984',
      novelId: '86fe62df-ca52-47ef-8d62-c07a3c3065b2', // Resonance
      volumeNumber: 1,
      title: 'Vol 1: The Frequential Phantom',
      coverUrl: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?auto=format&fit=crop&w=600&h=800&q=80',
      synopsis: 'A melody in the dreams of millions triggers an investigation into the deep neural nets of Neo-Tokyo.',
    }
  ]

  const seededVolumes = await db.insert(schema.volumes).values(mockVolumes).returning()
  console.log(`Seeded ${seededVolumes.length} volumes.`)

  // 5. Seed chapters
  console.log('Seeding chapters...')
  const mockChapters = [
    {
      id: 'ab238cf7-2a54-46c5-8422-fa270cf75221',
      novelId: '50e261bd-8c4d-44b2-b5e1-88404a3adbc4', // Abyss
      volumeId: 'e48a12e2-63f2-4e8c-85a2-094ee128fcbb',
      chapterNumber: 1,
      title: 'Chapter 1: The Gate of Tears',
      content: `# The Gate of Tears\n\nThere was no sun inside the Labyrinth. Only the cold, persistent dampness that seeped into one's bones.\n\nRaymond dragged his chains across the obsidian flagstones. The gate behind him shut with a hollow resonance that sounded like the toll of a death knell. \n\n"You are now property of the Abyss," the guard had sneered before throwing him down the hatch. \n\nHe had only his spectacles, a worn coat, and a burning memory of the texts he had translated. The texts that had branded him a heretic. The books that detailed the world before the *Great Deluge* [^1].\n\nAs Raymond gathered his footing, a faint, bioluminescent light shimmered in the dark corridor ahead. A girl stood there, her hair glowing like starlight, wearing garments unfamiliar to any guild of the capital.\n\n"Have you come to read the stars too?" she asked, her voice echoing in the silence.`,
      wordCount: 2500,
      translatorId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      translatorGroup: 'Abyss Translations',
      isPublished: true,
      publishAt: new Date(),
    },
    {
      id: 'bc123df7-2a54-46c5-8422-fa270cf75222',
      novelId: '50e261bd-8c4d-44b2-b5e1-88404a3adbc4', // Abyss
      volumeId: 'e48a12e2-63f2-4e8c-85a2-094ee128fcbb',
      chapterNumber: 2,
      title: 'Chapter 2: The Bioluminescent Scholar',
      content: `# Chapter 2: The Bioluminescent Scholar\n\n"Stars?" Raymond muttered, pushing his cracked spectacles up the bridge of his nose. "There are no stars in this crypt."\n\n"There are," she insisted, pointing to the ceiling. \n\nRaymond looked up. Clinging to the damp, arched vault were thousands of tiny, glowing blue fungi. They did not pulse aimlessly; they blinked in complex, mathematical intervals. A celestial tapestry composed of spores.\n\n"It is the *Aetherial Flora* [^2]," she explained. "They record the memories of those who died here."\n\nShe introduced herself as Lyra, a descendant of the temple guardians who had been forgotten by the surface empire centuries ago. She offered him a leaf of the glowing plant. "If you are to survive the lower tiers, you must learn to listen to them."\n\nRaymond hesitated. As a scholar, he knew the tales of the abyss-sickness. But looking at the dark path ahead, and the whispers crawling from the pitch-black shadows, he realized he had no other choice.`,
      wordCount: 2600,
      translatorId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      translatorGroup: 'Abyss Translations',
      isPublished: true,
      publishAt: new Date(),
    },
    {
      id: 'cd345df7-2a54-46c5-8422-fa270cf75223',
      novelId: '50e261bd-8c4d-44b2-b5e1-88404a3adbc4', // Abyss
      volumeId: 'e48a12e2-63f2-4e8c-85a2-094ee128fcbb',
      chapterNumber: 3,
      title: 'Chapter 3: The Whispers in the Dark',
      content: `# Chapter 3: The Whispers in the Dark\n\nThe third tier of the Abyss was silent, save for the hum of the spores.\n\nRaymond and Lyra walked along the narrow ledge. Below them lay a bottomless chasm, from which a cold wind blew constantly. It smelled of ozone and ancient paper.\n\n"They are coming," Lyra suddenly whispered, extinguishing her staff's light.\n\nRaymond froze. In the distance, he heard the click-clack of metal joints against stone. The imperial wardens—golems powered by the very souls of discarded heretics—were patrolling the sector.\n\n"Hold your breath," she said. "They react to the condensation of breath in the cold air."\n\nAs the iron construct marched past, its burning red eye sweeping the ledger, Raymond squeezed his eyes shut, his lungs screaming for air. It was then that the first voice entered his mind. *Save us, scholar.*`,
      wordCount: 2400,
      translatorId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      translatorGroup: 'Abyss Translations',
      isPublished: true,
      publishAt: new Date(),
    },
    {
      id: 'de456df7-2a54-46c5-8422-fa270cf75224',
      novelId: '86fe62df-ca52-47ef-8d62-c07a3c3065b2', // Resonance
      volumeId: 'fa27ef9a-4c28-98e3-54cd-916c52bba984',
      chapterNumber: 1,
      title: 'Chapter 1: The Outlaw Frequency',
      content: `# The Outlaw Frequency\n\nThe oscilloscope didn't lie. \n\nInside her cluttered workshop in the neon-drenched alleyways of Akihabara, Rin adjusted the dial of her custom audio synthesizer. \n\n"A perfect 432.8 Hertz," she murmured, watching the green wave stabilize. "But it's not coming from a transmitter. It's coming from inside the *Neural Link* [^1] protocol."\n\nFor three days, the medical nets had reported a minor glitch: a minor neural tick in the auditory cortex of sleeping citizens. The government dismissed it as a routine firmware update anomaly. But Rin knew better. \n\nShe plugged her own cerebral deck into the terminal. She didn't use the standard filters; she wanted the raw feed. The cold wire slid into the port behind her ear.\n\nInstantly, the neon lights of her shop faded, replaced by the endless grid of the gridspace. And there it was—a haunting, melodic lullaby echoing through the digital void.`,
      wordCount: 2200,
      translatorId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      translatorGroup: 'Rin-Scanlations',
      isPublished: true,
      publishAt: new Date(),
    },
    {
      id: 'ef567df7-2a54-46c5-8422-fa270cf75225',
      novelId: '86fe62df-ca52-47ef-8d62-c07a3c3065b2', // Resonance
      volumeId: 'fa27ef9a-4c28-98e3-54cd-916c52bba984',
      chapterNumber: 2,
      title: 'Chapter 2: Cyberspace Melancholy',
      content: `# Chapter 2: Cyberspace Melancholy\n\nThe digital melody was like nothing Rin had ever heard. It wasn't composed of notes, but of raw emotion—grief, longing, and a desperate plea.\n\nAs she traveled along the outlaw channels, she noticed the data streams behaving strangely. The packets were grouping together like school of fish, moving to the rhythm of the melody.\n\n"It is a *Ghost Process* [^2]," a voice called out behind her.\n\nRin spun around. A digital avatar—a masked hacker wearing a traditional fox mask—stood on the virtual platform. \n\n"You shouldn't be here, Rin," the hacker said. "The cyber-security division is already deploying their scrubbers. Anyone caught in this frequency will have their neural deck fried."\n\n"I need to know who wrote this," Rin said, stepping forward. "It's not code. It's a human mind, fragmented and broadcasted across the net."\n\nThe hacker paused. "Then follow me. But be quick. The ICE is coming."`,
      wordCount: 2300,
      translatorId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9',
      translatorGroup: 'Rin-Scanlations',
      isPublished: true,
      publishAt: new Date(),
    }
  ]

  const seededChapters = await db.insert(schema.chapters).values(mockChapters).returning()
  console.log(`Seeded ${seededChapters.length} chapters.`)

  // 6. Seed footnotes
  console.log('Seeding footnotes...')
  const mockFootnotes = [
    {
      chapterId: 'ab238cf7-2a54-46c5-8422-fa270cf75221', // Abyss Ch 1
      marker: '[^1]',
      content: 'The Great Deluge refers to the cataclysmic event 300 years ago that flooded 90% of the surface world and drove humanity to build subterranean and high-altitude settlements.',
      positionIndex: 0,
    },
    {
      chapterId: 'bc123df7-2a54-46c5-8422-fa270cf75222', // Abyss Ch 2
      marker: '[^2]',
      content: 'Aetherial Flora is the scientific classification of the bioluminescent moss and fungi in the Labyrinth, which absorb residual mana and cognitive energy from the environment.',
      positionIndex: 0,
    },
    {
      chapterId: 'de456df7-2a54-46c5-8422-fa270cf75224', // Resonance Ch 1
      marker: '[^1]',
      content: 'Neural Link: The direct cerebral-cybernetic interface standard implanted in 95% of neo-tokyo citizens at age twelve to facilitate instant connection and augmented reality overlay.',
      positionIndex: 0,
    },
    {
      chapterId: 'ef567df7-2a54-46c5-8422-fa270cf75225', // Resonance Ch 2
      marker: '[^2]',
      content: 'Ghost Process: An orphan execution thread in operating systems that continues to run even after its parent process has been terminated or deleted. In cyberpunk slang, it refers to residual neural patterns of deceased users.',
      positionIndex: 0,
    }
  ]

  const seededFootnotes = await db.insert(schema.footnotes).values(mockFootnotes).returning()
  console.log(`Seeded ${seededFootnotes.length} footnotes.`)

  // 7. Seed forum categories
  console.log('Seeding forum categories...')
  const mockForumCategories = [
    {
      id: 'c10261bd-8c4d-44b2-b5e1-88404a3adbc1',
      name: 'General Discussion',
      slug: 'general',
      description: 'Discuss anything related to light novels, illustrations, and translations.',
      sortOrder: 1,
    },
    {
      id: 'c20261bd-8c4d-44b2-b5e1-88404a3adbc2',
      name: 'Translator Guild',
      slug: 'translators',
      description: 'For uploaders and translators to recruit, share resources, and coordinate projects.',
      sortOrder: 2,
    },
    {
      id: 'c30261bd-8c4d-44b2-b5e1-88404a3adbc3',
      name: 'Novel Recommendations',
      slug: 'recommendations',
      description: 'Looking for a new serial? Ask the community for recommendations here.',
      sortOrder: 3,
    },
    {
      id: 'c40261bd-8c4d-44b2-b5e1-88404a3adbc4',
      name: 'Feedback & Support',
      slug: 'feedback',
      description: 'Suggest new features, report bugs, and review site updates.',
      sortOrder: 4,
    }
  ]

  const seededCategories = await db.insert(schema.forumCategories).values(mockForumCategories).returning()
  console.log(`Seeded ${seededCategories.length} categories.`)

  // 8. Seed forum posts
  console.log('Seeding forum posts...')
  const mockForumPosts = [
    {
      id: 'f10261bd-8c4d-44b2-b5e1-88404a3adbc1',
      categoryId: 'c10261bd-8c4d-44b2-b5e1-88404a3adbc1', // General
      userId: 'fa270cf7-5221-4d33-a6fe-6e6ad9d2243d', // Alice
      title: 'What makes a Light Novel translation truly "premium"?',
      content: 'In my opinion, it is not just about grammatical accuracy. It is about capturing the original tone of the author. Serifs and newsprint layouts on this site make a huge difference in readability compared to generic web formats! What do you guys think?',
      isPinned: true,
      isLocked: false,
      viewCount: 124,
      replyCount: 2,
    },
    {
      id: 'f20261bd-8c4d-44b2-b5e1-88404a3adbc2',
      categoryId: 'c30261bd-8c4d-44b2-b5e1-88404a3adbc3', // Recommendations
      userId: 'fa270cf7-5221-4d33-a6fe-6e6ad9d2243d', // Alice
      title: 'Looking for dark fantasy recommendations with high stakes',
      content: 'I recently finished reading the latest volume of a popular grimdark series and I am craving something similar. I love deep world-building, severe consequences, and anti-hero protagonists. Is "Chronicles of the Dark Abyss" worth checking out?',
      isPinned: false,
      isLocked: false,
      viewCount: 45,
      replyCount: 1,
    }
  ]

  const seededPosts = await db.insert(schema.forumPosts).values(mockForumPosts).returning()
  console.log(`Seeded ${seededPosts.length} posts.`)

  // 9. Seed forum replies
  console.log('Seeding forum replies...')
  const mockForumReplies = [
    {
      postId: 'f10261bd-8c4d-44b2-b5e1-88404a3adbc1', // Premium translation post
      userId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9', // Translator Zero
      content: 'Agreed! As a translator, having typographical controls like line heights and custom fonts lets us format footnotes and spacing properly. The reading experience becomes immersive instead of fatiguing.',
    },
    {
      postId: 'f10261bd-8c4d-44b2-b5e1-88404a3adbc1',
      userId: 'd8c728e5-3642-4b78-9e67-d8120fa22511', // Admin
      content: 'That is exactly why we designed the site with zero-radius borders and high-contrast margins. We want to celebrate the editorial craft of translation.',
    },
    {
      postId: 'f20261bd-8c4d-44b2-b5e1-88404a3adbc2', // Dark fantasy recommendation post
      userId: 'e16bb497-2a54-46c5-8422-77ef688b1cc9', // Translator Zero
      content: 'Absolutely! Chronicles of the Dark Abyss is exactly what you are looking for. The world-building is highly detailed, and the magic system is integrated directly with the psychology of the exile characters.',
    }
  ]

  const seededReplies = await db.insert(schema.forumReplies).values(mockForumReplies).returning()
  console.log(`Seeded ${seededReplies.length} replies.`)

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal Seeding Error:', err)
  process.exit(1)
})
