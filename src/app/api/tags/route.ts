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
  allTags = Array.from(new Set(allTags))

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
    allTags = Array.from(new Set(allTags))
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

// Generate base tags for a platform when database doesn't exist
function generateBaseTagsForPlatform(platform: string): string[] {
  const baseTags = [
    // Gaming
    'fortnite', 'minecraft', 'gta', 'callofduty', 'valorant', 'apexlegends',
    'leagueoflegends', 'dota2', 'csgo', 'overwatch', 'warzone', 'roblox',
    'genshinimpact', 'mobilelegends', 'freefire', 'amongus', 'fifa', 'nba2k',
    // Viral/Trending
    'viral', 'trending', 'fyp', 'foryou', 'foryoupage', 'viralvideo',
    'trendingnow', 'explore', 'explorepage', 'discover', 'discoverpage',
    // Content creator
    'contentcreator', 'creator', 'content', 'video', 'viralcontent',
    'trendingcontent', 'popular', 'hot', 'new', 'latest', '2026',
    // Content types
    'funny', 'comedy', 'meme', 'memes', 'lol', 'hilarious',
    'entertainment', 'fun', 'laugh', 'reaction', 'react', 'duet', 'stitch',
    'remix', 'cover', 'dance', 'dancing', 'tutorial', 'howto', 'tips',
    'tricks', 'hacks', 'lifehack', 'art', 'artist', 'artwork', 'drawing',
    'gaming', 'gamer', 'game', 'play', 'player', 'win', 'victory',
    'fitness', 'workout', 'gym', 'health', 'food', 'foodie', 'cooking',
    'fashion', 'style', 'outfit', 'beauty', 'makeup', 'transformation',
    // Music
    'music', 'song', 'audio', 'sound', 'beat', 'remix', 'cover',
    // IRL
    'irl', 'vlog', 'daily', 'routine', 'stream', 'live', 'behindthescenes'
  ]
  
  // Platform-specific tags
  const platformSpecific: Record<string, string[]> = {
    'tiktok': [
      'tiktok', 'tiktokviral', 'tiktoktrending', 'tiktokdance', 'tiktokchallenge',
      'tiktoktrend', 'tiktoksounds', 'tiktokmemes', 'tiktokcomedy', 'tiktokfyp',
      'tiktokforyou', 'tiktoklive', 'tiktokcreator', 'tiktokgrowth'
    ],
    'instagram': [
      'instagram', 'insta', 'ig', 'instaviral', 'reels', 'reelsinstagram',
      'instareels', 'reelsvideo', 'instagramreels', 'instadaily', 'instagood',
      'instagramgrowth', 'reelsviral', 'reelitfeelit'
    ],
    'youtube-shorts': [
      'youtubeshorts', 'shorts', 'ytshorts', 'shortsviral', 'shortsyoutube',
      'youtubeshort', 'shortvideo', 'shortsfeed', 'youtube', 'youtuber',
      'youtubegrowth', 'youtubetips', 'shortsstrategy', 'shortstips'
    ],
    'youtube-long': [
      'youtube', 'youtuber', 'youtubechannel', 'youtubevideo', 'youtubegaming',
      'gamingchannel', 'letsplay', 'walkthrough', 'gameplay', 'gamer',
      'youtubegrowth', 'youtubetips', 'videoediting', 'thumbnail'
    ],
    'facebook-reels': [
      'facebook', 'facebookreels', 'fbreels', 'meta', 'facebookvideo',
      'facebookviral', 'facebookgaming', 'facebooklive', 'facebookcreator',
      'facebookgrowth', 'reelsfacebook'
    ]
  }
  
  const platformTags = platformSpecific[platform] || []
  return [...baseTags, ...platformTags]
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

// Enhanced local tag generation - no API calls
function generateTagsFromDescription(description: string, platformTags: string[], platform: string, count: number): string[] {
  const descLower = description.toLowerCase()
  
  // Extract all meaningful keywords from description
  const extractKeywords = (text: string): string[] => {
    return text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => ['and', 'the', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'while', 'about', 'after', 'before', 'between', 'through', 'during', 'above', 'below', 'under', 'over'].indexOf(word) === -1)
  }
  
  const descriptionWords = extractKeywords(descLower)
  
  // Game detection - identify the PRIMARY game being played
  const gameKeywords: Record<string, string[]> = {
    'fortnite': ['fortnite', 'victory', 'royale', 'battle', 'build', 'building', 'edit', 'editing', 'pump', 'tac', 'scar', 'p90', 'rocket', 'grenade', 'storm', 'circle', 'zone', 'bus', 'island', 'chapter', 'season', 'skin', 'emote', 'dance', 'vbucks', 'epic', 'lobby', 'drop', 'axe', 'rpg', 'ar', 'smg', 'sniper', 'shotgun'],
    'minecraft': ['minecraft', 'craft', 'mining', 'mine', 'block', 'blocks', 'biome', 'creeper', 'zombie', 'skeleton', 'enderman', 'dragon', 'nether', 'end', 'diamond', 'iron', 'gold', 'redstone', 'building', 'survival', 'creative', 'server', 'realm', 'mod', 'cave', 'spider', 'skeleton', 'steve', 'alex', 'villager', 'creeper'],
    'cod': ['cod', 'call', 'duty', 'warzone', 'modern', 'warfare', 'black', 'ops', 'cold', 'war', 'vanguard', 'loadout', 'killstreak', 'nuke', 'camo', 'grind', 'meta', 'sniper', 'quickscope', 'headshot', 'gulag', 'verdansk', 'rebirth', 'dmz', 'plunder'],
    'valorant': ['valorant', 'agent', 'jett', 'sage', 'omen', 'brimstone', 'phoenix', 'raze', 'reyna', 'viper', 'cypher', 'sova', 'breach', 'killjoy', 'skye', 'yoru', 'astra', 'kayo', 'chamber', 'neon', 'fade', 'harbor', 'gekko', 'deadlock', 'iso', 'clove', 'vyse', 'tejo', 'waylay', 'ace', 'clutch', 'eco', 'buy', 'round', 'spike', 'plant', 'defuse', 'site', 'rank', 'radiant', 'immortal', 'ascendant'],
    'gta': ['gta', 'grand', 'theft', 'auto', 'gta5', 'gta6', 'gtaonline', 'gtarp', 'los', 'santos', 'vice', 'city', 'heist', 'mission', 'franklin', 'michael', 'trevor', 'lamar', 'online', 'roleplay', 'mod'],
    'apex': ['apex', 'apexlegends', 'wraith', 'octane', 'pathfinder', 'bloodhound', 'gibraltar', 'lifeline', 'caustic', 'mirage', 'bangalore', 'revenant', 'crypto', 'wattson', 'horizon', 'fuse', 'valkyrie', 'seer', 'ash', 'mad', 'maggie', 'catalyst', 'conduit', 'newcastle', 'vantage', 'crypto', 'loba', 'rampart'],
    'league': ['league', 'lol', 'leagueoflegends', 'teemo', 'yasuo', 'zed', 'ahri', 'garen', 'darius', 'thresh', 'blitzcrank', 'jinx', 'lux', 'zed', 'master', 'yi', 'jungle', 'mid', 'top', 'adc', 'support', 'rank', 'challenger', 'diamond', 'gold', 'silver', 'bronze'],
    'roblox': ['roblox', 'obby', 'tower', 'hell', 'adopt', 'me', 'brookhaven', 'blox', 'fruits', 'murder', 'mystery', 'pet', 'simulator', 'tycoon', 'ninja', 'legends', 'brawl', 'stars', 'arsenal', 'mm2', 'mad', 'city'],
    'genshin': ['genshin', 'impact', 'teyvat', 'mondstadt', 'liyue', 'inazuma', 'sumeru', 'fontaine', 'natlan', 'zhongli', 'raiden', 'venti', 'nahida', 'furina', 'mualani', 'xilonen', 'citlali', 'chasca', 'archon', 'vision', 'element', 'pyro', 'hydro', 'anemo', 'electro', 'geo', 'cryo', 'dendro'],
    'overwatch': ['overwatch', 'ow', 'ow2', 'tracer', 'soldier', 'reaper', 'widowmaker', 'mercy', 'dva', 'reinhardt', 'zarya', 'genji', 'hanzo', 'junkrat', 'mei', 'torbjorn', 'winston', 'symmetra', 'pharah', 'ana', 'bastion', 'zenyatta', 'lucio', 'mccree', 'cassidy', 'sigma', 'wrecking', 'ball', 'ashe', 'baptiste', 'echo', 'sojourn', 'kiriko', 'ramattra', 'junker', 'queen', 'lifeweaver', 'venture', 'mauga']
  }
  
  // Detect the primary game by counting keyword matches
  let detectedGame: string | null = null
  let maxGameScore = 0
  
  const gameKeys = Object.keys(gameKeywords)
  for (let i = 0; i < gameKeys.length; i++) {
    const game = gameKeys[i]
    const keywords = gameKeywords[game]
    let gameScore = 0
    for (let j = 0; j < keywords.length; j++) {
      if (descLower.indexOf(keywords[j]) !== -1) {
        gameScore += 1
      }
    }
    if (gameScore > maxGameScore && gameScore >= 1) {
      maxGameScore = gameScore
      detectedGame = game
    }
  }
  
  // Content type detection (separate from game detection)
  const contentTypes: Record<string, string[]> = {
    'editing': ['edit', 'editing', 'montage', 'clip', 'clips', 'highlight', 'highlights', 'compilation', 'best', 'moments', 'slowmo', 'transition', 'effect', 'effects', 'filter', 'capcut', 'premiere', 'after', 'effects', 'cinematic'],
    'funny': ['funny', 'hilarious', 'lol', 'lmao', 'laugh', 'laughing', 'comedy', 'comedic', 'haha', 'meme', 'memes', 'joke', 'prank', 'fail', 'fails', 'funnymoments', 'cringe', 'epic', 'fail'],
    'tutorial': ['tutorial', 'guide', 'how', 'tips', 'tricks', 'learn', 'lesson', 'beginner', 'advanced', 'pro', 'strategy', 'strategies', 'setup', 'settings', 'sensitivity', 'howto', 'help', 'explained'],
    'reaction': ['react', 'reacting', 'reaction', 'responds', 'response', 'duet', 'stitch', 'remix', 'reply'],
    'viral': ['viral', 'trending', 'trend', 'fyp', 'foryou', 'foryoupage', 'explore', 'discover', 'algorithm', 'boost', 'growth', 'grow', 'content', 'creator'],
    'music': ['music', 'song', 'audio', 'sound', 'beat', 'remix', 'cover', 'dance', 'dancing', 'tiktok', 'trending', 'viral'],
    'irl': ['irl', 'real', 'life', 'vlog', 'vlogging', 'day', 'daily', 'routine', 'stream', 'streaming', 'live', 'behind', 'scenes', 'bts'],
    'gaming': ['game', 'gaming', 'gamer', 'play', 'playing', 'player', 'win', 'winning', 'victory', 'kill', 'frag', 'match', 'round', 'level', 'boss', 'quest', 'mission', 'multiplayer', 'competitive', 'esports', 'tournament', 'rank', 'ranked', 'clutch', 'ace', 'mvp', 'noob', 'pro', 'grind', 'loot', 'drop', 'spawn', 'respawn']
  }
  
  // Detect content types
  const detectedContentTypes: string[] = []
  const contentTypeKeys = Object.keys(contentTypes)
  for (let i = 0; i < contentTypeKeys.length; i++) {
    const type = contentTypeKeys[i]
    const keywords = contentTypes[type]
    for (let j = 0; j < keywords.length; j++) {
      if (descLower.indexOf(keywords[j]) !== -1) {
        detectedContentTypes.push(type)
        break
      }
    }
  }
  
  // Score each tag with intelligent game-specific logic
  const scoredTags = platformTags.map(tag => {
    let score = 0
    const tagLower = tag.toLowerCase()
    
    // Direct word matches from description (highest priority)
    for (let i = 0; i < descriptionWords.length; i++) {
      const word = descriptionWords[i]
      if (tagLower === word) score += 30
      else if (tagLower.indexOf(word) !== -1) score += 20
      else if (word.indexOf(tagLower) !== -1 && tagLower.length > 3) score += 10
    }
    
    // GAME-SPECIFIC SCORING - Only boost the detected game
    if (detectedGame) {
      // Massive boost for tags matching the detected game
      if (tagLower.indexOf(detectedGame) !== -1) score += 50
      
      // Boost for game-specific keywords
      const gameSpecificKeywords = gameKeywords[detectedGame] || []
      for (let i = 0; i < gameSpecificKeywords.length; i++) {
        if (tagLower.indexOf(gameSpecificKeywords[i]) !== -1) {
          score += 25
        }
      }
      
      // HEAVY PENALTY for other games
      for (let i = 0; i < gameKeys.length; i++) {
        const otherGame = gameKeys[i]
        if (otherGame !== detectedGame && tagLower.indexOf(otherGame) !== -1) {
          score -= 100 // Penalize unrelated games heavily
        }
      }
    } else {
      // No specific game detected - only boost general gaming tags
      if (detectedContentTypes.indexOf('gaming') !== -1) {
        if (['game', 'gaming', 'gamer', 'play', 'player'].some(g => tagLower.indexOf(g) !== -1)) score += 15
      }
    }
    
    // Content type matching (medium priority)
    if (detectedContentTypes.indexOf('editing') !== -1) {
      if (tagLower.indexOf('edit') !== -1 || tagLower.indexOf('montage') !== -1 || tagLower.indexOf('clip') !== -1) score += 15
    }
    if (detectedContentTypes.indexOf('funny') !== -1) {
      if (tagLower.indexOf('funny') !== -1 || tagLower.indexOf('meme') !== -1 || tagLower.indexOf('lol') !== -1 || tagLower.indexOf('fail') !== -1) score += 15
    }
    if (detectedContentTypes.indexOf('tutorial') !== -1) {
      if (tagLower.indexOf('tutorial') !== -1 || tagLower.indexOf('guide') !== -1 || tagLower.indexOf('tips') !== -1 || tagLower.indexOf('howto') !== -1) score += 15
    }
    if (detectedContentTypes.indexOf('reaction') !== -1) {
      if (tagLower.indexOf('react') !== -1 || tagLower.indexOf('duet') !== -1 || tagLower.indexOf('stitch') !== -1) score += 15
    }
    
    // Platform-specific tags (low priority but relevant)
    if (tagLower.indexOf(platform.toLowerCase().replace('-', '')) !== -1) score += 10
    
    // Viral/discovery tags (always include a few)
    if (tagLower.indexOf('viral') !== -1 || tagLower.indexOf('trending') !== -1 || tagLower.indexOf('fyp') !== -1 || tagLower.indexOf('foryou') !== -1) score += 5
    
    // Length optimization - prefer medium-length tags
    if (tagLower.length >= 5 && tagLower.length <= 15) score += 3
    if (tagLower.length > 25) score -= 5
    
    return { tag, score }
  })
  
  // Sort by score descending
  scoredTags.sort((a, b) => b.score - a.score)
  
  // Get top tags
  const selectedTags = scoredTags.slice(0, count).map(st => st.tag)
  
  // If we don't have enough high-scoring tags, fill with viral/discovery tags
  if (selectedTags.length < count) {
    const viralTags = platformTags.filter(tag => 
      selectedTags.indexOf(tag) === -1 && 
      (tag.toLowerCase().indexOf('viral') !== -1 || tag.toLowerCase().indexOf('trending') !== -1 || tag.toLowerCase().indexOf('fyp') !== -1 || tag.toLowerCase().indexOf('foryou') !== -1 || tag.toLowerCase().indexOf('explore') !== -1 || tag.toLowerCase().indexOf('content') !== -1 || tag.toLowerCase().indexOf('creator') !== -1)
    )
    while (selectedTags.length < count && viralTags.length > 0) {
      selectedTags.push(viralTags.shift()!)
    }
  }
  
  // If still not enough, add platform-specific tags
  if (selectedTags.length < count) {
    const genericTags = platformTags.filter(tag => 
      selectedTags.indexOf(tag) === -1 && 
      tag.toLowerCase().indexOf(platform.toLowerCase().replace('-', '')) !== -1
    )
    while (selectedTags.length < count && genericTags.length > 0) {
      selectedTags.push(genericTags.shift()!)
    }
  }
  
  return selectedTags.slice(0, count)
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
    let platformTags = tagData.data?.[platform] || []
    
    // If no database exists, generate tags dynamically
    if (platformTags.length === 0) {
      console.log(`No tag database for ${platform}, generating dynamically...`)
      platformTags = generateBaseTagsForPlatform(platform)
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
    
    // Generate tags using local algorithm (no API calls)
    const generatedTags = generateTagsFromDescription(description, platformTags, platform, Math.min(count, 50))
    
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
    totalTags: Object.keys(data.data).reduce((acc: number, key: string) => acc + (data.data[key]?.length || 0), 0),
    lastUpdated: data.lastUpdated,
    provider
  })
}
