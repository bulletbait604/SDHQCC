import { NextResponse } from 'next/server'

const platforms = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube-shorts', name: 'YouTube Shorts' },
  { id: 'youtube-long', name: 'YouTube Long' },
  { id: 'facebook-reels', name: 'Facebook Reels' }
]

// Simple file-based storage
const DATA_FILE = './tags-data.json'

async function readData() {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'tags-data.json')
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { data: {}, lastUpdated: null, provider: null }
  }
}

async function writeData(data: any) {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'tags-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing tags data:', error)
  }
}

// Popular games list for gaming tags
const popularGames = [
  'fortnite', 'minecraft', 'gta', 'callofduty', 'valorant', 'apexlegends',
  'leagueoflegends', 'dota2', 'csgo', 'overwatch', 'pubg', 'warzone',
  'roblox', 'genshinimpact', 'mobilelegends', 'freefire', 'amongus',
  'fifa', 'nba2k', 'madden', 'rocketleague', 'fallguys', 'rust',
  'dayz', 'escapefromtarkov', 'rainbowsix', 'destiny2', 'warframe',
  'fortnitewinter', 'fortniteseason', 'minecraftbuild', 'minecraftpvp',
  'gtaonline', 'gtarp', 'codmobile', 'codm', 'warzonemobile',
  'wildrift', 'tft', 'autochess', 'hearthstone', 'magicarena',
  'pokemon', 'zelda', 'mario', 'sonic', 'sonicfrontiers', 'eldenring',
  'dark souls', 'bloodborne', 'sekiro', 'godofwar', 'uncharted',
  'lastofus', 'horizon', 'spiderman', 'batman', 'arkham', 'injustice',
  'mortalkombat', 'tekken', 'streetfighter', 'soulcalibur', 'guiltygear',
  'smashbros', 'mariokart', 'splatoon', 'animalcrossing', 'pokemonunite',
  'pokemongo', 'pokemonscarlet', 'pokemonviolet', 'legendofzelda',
  'tearsofthekingdom', 'breathofthewild', 'linksawakening', 'hyrule',
  'metroid', 'kirby', 'starfox', 'fzero', 'pikmin', 'warioware',
  'rhythmheaven', 'advancewars', 'fireemblem', 'xenoblade', 'bayonetta',
  'astralchain', 'arms', 'nintendoswitch', 'switchsports', 'wii',
  'wiisports', 'marioparty', 'mariogolf', 'mariotennis', 'mariostrikers',
  'luigismansion', 'yoshi', 'toad', 'peach', 'daisy', 'rosalina',
  'bowser', 'donkeykong', 'diddykong', 'kingkrool', 'ridley', 'samus',
  'zerosuitsamus', 'darksamus', 'kirby', 'kingdedede', 'metaknight',
  'bandanadee', 'waddledee', 'fox', 'falco', 'wolf', 'slippy',
  'peppy', 'krystal', 'captainfalcon', 'ganondorf', 'sheik', 'zelda',
  'link', 'younglink', 'toonlink', 'wolfLink', 'midna', 'tetra'
]

// Generate comprehensive tag database for a platform
async function generateTagDatabase(platform: string, apiKey: string, provider: 'openai' | 'deepseek' = 'openai') {
  const baseCategories = {
    gaming: [...popularGames],
    general: [
      'viral', 'trending', 'fyp', 'foryou', 'foryoupage', 'viralvideo',
      'trendingnow', 'explore', 'explorepage', 'discover', 'discoverpage',
      'contentcreator', 'creator', 'content', 'video', 'viralcontent',
      'trendingcontent', 'popular', 'hot', 'new', 'latest', 'now',
      'today', '2026', 'newvideo', 'justposted', 'fresh', 'update'
    ],
    niche: [
      'funny', 'comedy', 'meme', 'memes', 'lol', 'lmao', 'hilarious',
      'entertainment', 'entertaining', 'fun', 'enjoy', 'smile', 'laugh',
      'reaction', 'react', 'responding', 'responds', 'duet', 'stitch',
      'remix', 'remixed', 'version', 'cover', 'coversong', 'dance',
      'dancing', 'dancer', 'choreography', 'tutorial', 'howto', 'tips',
      'tricks', 'hacks', 'lifehack', 'diy', 'doityourself', 'craft',
      'art', 'artist', 'artwork', 'drawing', 'painting', 'sketch',
      'digitalart', 'digitalartist', 'fanart', 'conceptart', 'illustration',
      'design', 'graphicdesign', 'logo', 'branding', 'marketing',
      'business', 'entrepreneur', 'success', 'motivation', 'inspiration',
      'inspirational', 'motivational', 'quote', 'quotes', 'mindset',
      'positivity', 'positive', 'goodvibes', 'vibes', 'mood', 'aesthetic',
      'aesthetics', 'satisfying', 'oddlysatisfying', 'asmr', 'relaxing',
      'calm', 'peaceful', 'meditation', 'mindfulness', 'yoga', 'fitness',
      'workout', 'gym', 'exercise', 'training', 'health', 'healthy',
      'wellness', 'nutrition', 'food', 'foodie', 'cooking', 'recipe',
      'recipes', 'baking', 'chef', 'homemade', 'delicious', 'yummy',
      'tasty', 'foodporn', 'foodgasm', 'mukbang', 'eat', 'eating',
      'review', 'reviews', 'unboxing', 'haul', 'shopping', 'shop',
      'fashion', 'style', 'outfit', 'ootd', 'lookbook', 'clothing',
      'beauty', 'makeup', 'skincare', 'hair', 'nails', 'tutorial',
      'transformation', 'beforeandafter', 'glowup', 'glowuptransformation'
    ]
  }

  const platformSpecific: Record<string, string[]> = {
    'tiktok': [
      'tiktok', 'tiktokviral', 'tiktoktrending', 'tiktokfamous', 'tiktokstar',
      'tiktokdance', 'tiktokchallenge', 'tiktoktrend', 'tiktoksounds',
      'tiktokmemes', 'tiktokcomedy', 'tiktokfunny', 'tiktokfyp',
      'tiktokforyou', 'tiktokforyoupage', 'tiktoklive', 'tiktokcreator',
      'tiktokgrowth', 'tiktoktips', 'tiktokalgorithm', 'tiktokstrategy'
    ],
    'instagram': [
      'instagram', 'insta', 'ig', 'instaviral', 'instatrending',
      'reels', 'reelsinstagram', 'reelsindia', 'reelitfeelit', 'reelkarofeelkaro',
      'instareels', 'reelsvideo', 'instagramreels', 'reelsviral',
      'instadaily', 'instagood', 'instamood', 'instalike', 'instafollow',
      'instagramgrowth', 'instagramtips', 'instagramalgorithm', 'contentstrategy'
    ],
    'youtube-shorts': [
      'youtubeshorts', 'shorts', 'ytshorts', 'shortsviral', 'shortsyoutube',
      'youtubeshort', 'shortvideo', 'shortsvideo', 'shortsfeed', 'shortsalgorithm',
      'youtube', 'youtuber', 'youtubegrowth', 'youtubechannel', 'subscribers',
      'youtubetips', 'youtubestrategy', 'shortsstrategy', 'shortstips'
    ],
    'youtube-long': [
      'youtube', 'youtuber', 'youtubechannel', 'youtubevideo', 'youtubegaming',
      'gamingchannel', 'letsplay', 'walkthrough', 'playthrough', 'gameplay',
      'gamer', 'gaming', 'gamingvideo', 'livegaming', 'streamer',
      'youtubegrowth', 'youtubetips', 'youtubeseo', 'thumbnail', 'title',
      'youtubestrategy', 'contentstrategy', 'videoediting', 'youtubeediting'
    ],
    'facebook-reels': [
      'facebook', 'facebookreels', 'fbreels', 'meta', 'metareels',
      'facebookvideo', 'facebookviral', 'facebooktrending', 'facebookpage',
      'facebookgaming', 'facebooklive', 'facebookcreator', 'facebookgrowth',
      'facebooktips', 'facebookstrategy', 'reelsfacebook', 'fbtips'
    ]
  }

  // Combine all base tags
  let allTags = [
    ...baseCategories.gaming,
    ...baseCategories.general,
    ...baseCategories.niche,
    ...(platformSpecific[platform] || [])
  ]

  // Remove duplicates
  allTags = [...new Set(allTags)]

  // If we have API access, generate more platform-specific tags
  if (apiKey) {
    try {
      const additionalTags = await generateAdditionalTags(platform, apiKey, provider)
      allTags = [...allTags, ...additionalTags]
    } catch (error) {
      console.error(`Error generating additional tags for ${platform}:`, error)
    }
  }

  // Ensure we have at least 20,000 tags by generating variations
  while (allTags.length < 20000) {
    const baseTag = allTags[Math.floor(Math.random() * allTags.length)]
    const variations = generateTagVariations(baseTag, platform)
    allTags.push(...variations)
    allTags = [...new Set(allTags)]
  }

  // Limit to 20,000
  return allTags.slice(0, 20000)
}

// Generate additional AI-powered tags
async function generateAdditionalTags(platform: string, apiKey: string, provider: 'openai' | 'deepseek') {
  const prompt = `Generate 100 popular and trending hashtags for ${platform} in 2026. 
Focus on:
1. Gaming-related tags
2. Viral/trending content tags
3. Content creator growth tags
4. Platform-specific algorithm-friendly tags

Return ONLY a JSON array of strings, like: ["tag1", "tag2", "tag3"]`

  try {
    if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a social media marketing expert specializing in hashtag research and optimization.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      const parsed = JSON.parse(content || '[]')
      return Array.isArray(parsed) ? parsed : parsed.tags || []
    } else {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey })
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a social media marketing expert specializing in hashtag research and optimization.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0].message.content
      const parsed = JSON.parse(content || '[]')
      return Array.isArray(parsed) ? parsed : parsed.tags || []
    }
  } catch (error) {
    console.error(`Error generating tags for ${platform}:`, error)
    return []
  }
}

// Generate variations of a tag
function generateTagVariations(tag: string, platform: string): string[] {
  const variations: string[] = []
  const suffixes = ['2026', 'viral', 'trending', 'best', 'top', 'new', 'daily', 'official', 'hd', '4k']
  const prefixes = ['best', 'top', 'new', 'official', 'pro', 'ultimate', 'epic', 'insane', 'crazy']
  
  suffixes.forEach(suffix => {
    if (!tag.includes(suffix)) {
      variations.push(`${tag}${suffix}`)
    }
  })
  
  prefixes.forEach(prefix => {
    if (!tag.includes(prefix)) {
      variations.push(`${prefix}${tag}`)
    }
  })
  
  return variations.slice(0, 5)
}

// Tag generation algorithm
function generateTagsFromDescription(description: string, platformTags: string[], platformData: any, count: number): string[] {
  const descriptionWords = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
  
  // Score each tag based on relevance
  const scoredTags = platformTags.map(tag => {
    let score = 0
    const tagLower = tag.toLowerCase()
    
    // Direct match with description words
    descriptionWords.forEach(word => {
      if (tagLower.includes(word)) score += 10
      if (word.includes(tagLower)) score += 5
    })
    
    // Boost gaming tags if gaming-related words in description
    const gamingWords = ['game', 'gaming', 'play', 'player', 'win', 'victory', 'kill', 'match', 'round']
    if (gamingWords.some(gw => descriptionWords.includes(gw))) {
      if (popularGames.some(g => tagLower.includes(g))) score += 15
    }
    
    // Platform-specific boosts from algorithm data
    if (platformData?.titleTips?.toLowerCase().includes(tagLower)) score += 8
    if (platformData?.descriptionTips?.toLowerCase().includes(tagLower)) score += 5
    
    // Boost viral/trending tags for discovery
    if (tagLower.includes('viral') || tagLower.includes('trending') || tagLower.includes('fyp')) {
      score += 3
    }
    
    return { tag, score }
  })
  
  // Sort by score and return top tags
  scoredTags.sort((a, b) => b.score - a.score)
  return scoredTags.slice(0, count).map(st => st.tag)
}

// GET endpoint - retrieve tag database status
export async function GET() {
  const storedData = await readData()
  return NextResponse.json(storedData)
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10 } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    // Read tag database
    const tagData = await readData()
    const platformTags = tagData.data?.[platform] || []
    
    if (platformTags.length === 0) {
      return NextResponse.json({ error: 'Tag database not available for this platform' }, { status: 404 })
    }
    
    // Read algorithm data for platform-specific tips
    let algorithmData = null
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const algoPath = path.join(process.cwd(), 'algorithm-data.json')
      const algoRaw = await fs.readFile(algoPath, 'utf-8')
      const algoData = JSON.parse(algoRaw)
      algorithmData = algoData.data?.[platform] || null
    } catch (error) {
      console.error('Could not read algorithm data:', error)
    }
    
    // Generate tags
    const generatedTags = generateTagsFromDescription(description, platformTags, algorithmData, Math.min(count, 50))
    
    return NextResponse.json({
      tags: generatedTags,
      platform,
      count: generatedTags.length,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating tags:', error)
    return NextResponse.json({ error: 'Failed to generate tags' }, { status: 500 })
  }
}

// PUT endpoint - refresh tag database (admin only)
export async function PUT() {
  const openaiKey = process.env.OPENAI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!openaiKey && !deepseekKey) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 })
  }

  // Prefer OpenAI if available
  const useDeepSeek = !openaiKey && !!deepseekKey
  const apiKey = openaiKey || deepseekKey
  const provider: 'openai' | 'deepseek' = useDeepSeek ? 'deepseek' : 'openai'
  
  console.log(`Refreshing tag database using ${provider.toUpperCase()} API`)
  
  const data: any = { data: {}, lastUpdated: new Date().toISOString(), provider }

  for (const platform of platforms) {
    console.log(`Generating tags for ${platform.name}...`)
    const tags = await generateTagDatabase(platform.id, apiKey!, provider)
    data.data[platform.id] = tags
    console.log(`Generated ${tags.length} tags for ${platform.name}`)
  }

  await writeData(data)

  return NextResponse.json({
    success: true,
    message: `Tag database refreshed for ${platforms.length} platforms`,
    totalTags: Object.values(data.data).reduce((acc: number, tags: any) => acc + tags.length, 0),
    lastUpdated: data.lastUpdated,
    provider
  })
}
