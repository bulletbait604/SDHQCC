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
    'irl', 'vlog', 'daily', 'routine', 'stream', 'live', 'behindthescenes',
    // Animals
    'animals', 'animal', 'pets', 'pet', 'dog', 'dogs', 'puppy', 'puppies',
    'cat', 'cats', 'kitten', 'kittens', 'frog', 'frogs', 'toad', 'toads',
    'bird', 'birds', 'fish', 'fishes', 'wildlife', 'nature', 'wild',
    'cute', 'adorable', 'funnyanimals', 'petlover', 'animallover',
    // Nature
    'nature', 'natural', 'outdoor', 'outdoors', 'forest', 'forests',
    'pond', 'ponds', 'lake', 'lakes', 'river', 'rivers', 'ocean', 'oceans',
    'sea', 'seas', 'beach', 'beaches', 'mountain', 'mountains', 'sky',
    'sunset', 'sunrise', 'clouds', 'weather', 'season', 'seasons',
    // Scenarios
    'talking', 'talk', 'conversation', 'conversations', 'chat', 'chats',
    'dancing', 'dance', 'singing', 'sing', 'playing', 'play', 'running',
    'walking', 'walk', 'swimming', 'swim', 'flying', 'fly', 'jumping',
    'eating', 'eat', 'drinking', 'drink', 'sleeping', 'sleep', 'fighting',
    // Objects
    'car', 'cars', 'vehicle', 'vehicles', 'house', 'home', 'building',
    'buildings', 'city', 'cities', 'town', 'towns', 'road', 'roads',
    'phone', 'phones', 'computer', 'computers', 'laptop', 'laptops',
    // People
    'people', 'person', 'human', 'humans', 'man', 'men', 'woman', 'women',
    'boy', 'boys', 'girl', 'girls', 'kid', 'kids', 'child', 'children',
    'baby', 'babies', 'family', 'families', 'friend', 'friends',
    // Colors
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black',
    'white', 'brown', 'gray', 'colour', 'color', 'colourful', 'colorful',
    // Time
    'morning', 'afternoon', 'evening', 'night', 'day', 'daily', 'today',
    'tomorrow', 'yesterday', 'week', 'month', 'year', '2026',
    // Emotions
    'happy', 'sad', 'angry', 'excited', 'scared', 'surprised', 'love',
    'hate', 'funny', 'serious', 'dramatic', 'emotional', 'feelings'
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
    ],
    'twitch': [
      'twitch', 'twitchtv', 'twitchstreamer', 'twitchstream', 'twitchchat',
      'twitchcommunity', 'twitchprime', 'twitchsubs', 'twitchviewer', 'twitchviewers',
      'twitchgaming', 'twitchirl', 'twitchcreative', 'twitchmusic', 'twitchjustchatting',
      'twitchraid', 'twitchhost', 'twitchdrops', 'twitchbits', 'twitchdonation',
      'twitchemote', 'twitchkappa', 'twitchpogchamp', 'twitchlul', 'twitchmonkas',
      'twitchkekw', 'twitchomegalul', 'twitchforsen', 'twitchxqc', 'twitchpokimane',
      'twitchninja', 'twitchshroud', 'twitchtimthetatman', 'twitchsummit1g',
      'twitchlirik', 'twitchsodapoppin', 'twitchdocm77', 'twitchasmonkgold',
      'twitchesl_csgo', 'twitchn0thing', 'twitchreckful', 'twitchmizkif',
      'twitchjakenbakelive', 'twitchmoistcr1tikal', 'twitchhasanabi', 'twitchpokimanelol',
      'twitchninja', 'twitchshroud', 'twitchtimthetatman', 'twitchsummit1g',
      'twitchlirik', 'twitchsodapoppin', 'twitchdocm77', 'twitchasmonkgold',
      'twitchesl_csgo', 'twitchn0thing', 'twitchreckful', 'twitchmizkif',
      'twitchjakenbakelive', 'twitchmoistcr1tikal', 'twitchhasanabi', 'twitchpokimanelol'
    ],
    'kick': [
      'kick', 'kickcom', 'kickstreamer', 'kickstream', 'kickchat', 'kickcommunity',
      'kickgaming', 'kickirl', 'kickcreative', 'kickmusic', 'kickjustchatting',
      'kickraid', 'kickhost', 'kicksub', 'kickviewer', 'kickviewers',
      'kickemote', 'kickemotes', 'kickbits', 'kickdonation', 'kicktips',
      'kickadinsross', 'kickxqc', 'kicktrainwreckstv', 'kickdestiny', 'kickmizkif',
      'kickhassan', 'kickjakenbakelive', 'kickmoistcr1tikal', 'kickadinsross',
      'kickxqc', 'kicktrainwreckstv', 'kickdestiny', 'kickmizkif', 'kickhassan',
      'kickjakenbakelive', 'kickmoistcr1tikal'
    ],
    'youtubelive': [
      'youtubelive', 'youtube', 'live', 'stream', 'youtube', 'live', 'stream',
      'youtubelivestream', 'youtubelivechat', 'youtubelivecommunity', 'youtubelivegaming',
      'youtubeliveirl', 'youtubelivemusic', 'youtubelivecreative', 'youtubelivejustchatting',
      'youtubelivepremiere', 'youtubeliveevents', 'youtubeliveconcerts', 'youtubelivesports',
      'youtubelivenews', 'youtubelivepodcast', 'youtubeliveinterview', 'youtubeliveqanda',
      'youtubelivegiveaway', 'youtubeliveraid', 'youtubelivehost', 'youtubelivesub',
      'youtubelivedonation', 'youtubelivesuperchat', 'youtubelivemembership', 'youtubelivejoin'
    ],
    'facebooklive': [
      'facebooklive', 'fb', 'live', 'facebook', 'live', 'stream', 'facebooklivestream',
      'facebooklivevideo', 'facebooklivechat', 'facebooklivecommunity', 'facebooklivegaming',
      'facebookliveirl', 'facebooklivemusic', 'facebooklivecreative', 'facebooklivejustchatting',
      'facebookliveevents', 'facebookliveconcerts', 'facebooklivesports', 'facebooklivenews',
      'facebooklivepodcast', 'facebookliveinterview', 'facebookliveqanda', 'facebooklivegiveaway',
      'facebooklivereaction', 'facebooklivecomment', 'facebooklivelike', 'facebookliveshare',
      'facebooklivegroup', 'facebooklivepage', 'facebookliveprofile', 'facebooklivebroadcast'
    ],
    'trovo': [
      'trovo', 'trovolive', 'trovostream', 'trovostreamer', 'trovochat', 'trovocommunity',
      'trovogaming', 'trovoirl', 'trovocreative', 'trovomusic', 'trovojustchatting',
      'trovoraid', 'trovohost', 'trovosub', 'trovoviewer', 'trovoviewers',
      'trovoemote', 'trovoemotes', 'trovobits', 'trovodonation', 'trovotips',
      'trovogrowth', 'trovopartner', 'trovoaffiliate', 'trovoexclusive', 'trovoprogram'
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

// In-house AI Tag Generation System with Advanced NLP
function generateTagsFromDescription(description: string, platformTags: string[], platform: string, count: number): string[] {
  const descLower = description.toLowerCase()
  
  // Advanced NLP: Extract words with position and context
  const extractWordFeatures = (text: string): Array<{word: string, position: number, isStart: boolean, isEnd: boolean}> => {
    const words = text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => ['and', 'the', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'while', 'about', 'after', 'before', 'between', 'through', 'during', 'above', 'below', 'under', 'over'].indexOf(word) === -1)
    
    return words.map((word, index) => ({
      word,
      position: index,
      isStart: index === 0,
      isEnd: index === words.length - 1
    }))
  }
  
  const wordFeatures = extractWordFeatures(descLower)
  const descriptionWords = wordFeatures.map(f => f.word)
  
  // Synonym expansion for better semantic matching
  const synonymMap: Record<string, string[]> = {
    'good': ['great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 'superb', 'outstanding', 'brilliant', 'perfect'],
    'bad': ['terrible', 'awful', 'horrible', 'poor', 'dreadful', 'lousy', 'subpar', 'inferior', 'lackluster'],
    'big': ['huge', 'massive', 'large', 'giant', 'enormous', 'colossal', 'immense', 'vast', 'gigantic', 'monstrous'],
    'small': ['tiny', 'little', 'mini', 'micro', 'petite', 'compact', 'small', 'minute', 'diminutive'],
    'fast': ['quick', 'rapid', 'swift', 'speedy', 'hasty', 'brisk', 'accelerated', 'instant', 'lightning'],
    'slow': ['sluggish', 'leisurely', 'gradual', 'unhurried', 'delayed', 'lagging', 'crawling', 'plodding'],
    'funny': ['hilarious', 'humorous', 'comical', 'amusing', 'entertaining', 'witty', 'laughable', 'comic'],
    'scary': ['terrifying', 'frightening', 'horror', 'spooky', 'creepy', 'eerie', 'chilling', 'alarming'],
    'cool': ['awesome', 'amazing', 'impressive', 'incredible', 'fantastic', 'rad', 'sick', 'dope', 'lit'],
    'hard': ['difficult', 'challenging', 'tough', 'demanding', 'arduous', 'complex', 'complicated'],
    'easy': ['simple', 'effortless', 'straightforward', 'basic', 'uncomplicated', 'painless', 'breeze'],
    'new': ['fresh', 'recent', 'latest', 'modern', 'current', 'upcoming', 'brand', 'just', 'released'],
    'old': ['ancient', 'vintage', 'classic', 'aged', 'outdated', 'obsolete', 'antique', 'historic'],
    'best': ['top', 'greatest', 'finest', 'ultimate', 'supreme', 'premium', 'elite', 'superior'],
    'worst': ['poorest', 'lowest', 'bottom', 'terrible', 'awful', 'dreadful', 'abysmal'],
    'happy': ['joyful', 'cheerful', 'delighted', 'pleased', 'glad', 'content', 'satisfied', 'ecstatic'],
    'sad': ['unhappy', 'miserable', 'depressed', 'sorrowful', 'gloomy', 'downcast', 'melancholy'],
    'angry': ['mad', 'furious', 'irate', 'enraged', 'livid', 'outraged', 'incensed'],
    'smart': ['intelligent', 'clever', 'brilliant', 'genius', 'bright', 'sharp', 'wise', 'brainy'],
    'stupid': ['dumb', 'idiotic', 'foolish', 'unintelligent', 'dense', 'slow', 'dimwitted'],
    'beautiful': ['gorgeous', 'stunning', 'lovely', 'attractive', 'pretty', 'handsome', 'elegant'],
    'ugly': ['hideous', 'unattractive', 'unsightly', 'repulsive', 'grotesque', 'homely'],
    'important': ['significant', 'crucial', 'vital', 'essential', 'critical', 'major', 'key'],
    'unimportant': ['trivial', 'insignificant', 'minor', 'negligible', 'irrelevant', 'petty'],
    'popular': ['famous', 'wellknown', 'trending', 'viral', 'hot', 'mainstream', 'celebrated'],
    'unpopular': ['obscure', 'unknown', 'niche', 'underrated', 'overlooked', 'forgotten'],
    'win': ['victory', 'triumph', 'success', 'conquer', 'defeat', 'beat', 'overcome', 'prevail'],
    'lose': ['defeat', 'failure', 'loss', 'fall', 'crash', 'bust', 'fail', 'collapse'],
    'play': ['game', 'gaming', 'match', 'compete', 'battle', 'challenge', 'engage'],
    'watch': ['view', 'see', 'observe', 'look', 'witness', 'spectate', 'monitor'],
    'make': ['create', 'build', 'construct', 'produce', 'generate', 'craft', 'develop'],
    'get': ['obtain', 'acquire', 'receive', 'gain', 'secure', 'achieve', 'earn'],
    'go': ['travel', 'move', 'proceed', 'head', 'journey', 'venture', 'proceed'],
    'run': ['jog', 'sprint', 'dash', 'race', 'hurry', 'rush', 'speed'],
    'walk': ['stroll', 'hike', 'march', 'trek', 'wander', 'roam', 'step'],
    'jump': ['leap', 'hop', 'bound', 'spring', 'vault', 'skip'],
    'eat': ['consume', 'devour', 'dine', 'feast', 'ingest', 'nibble', 'munch'],
    'drink': ['sip', 'guzzle', 'chug', 'swallow', 'quaff', 'imbibe'],
    'sleep': ['rest', 'nap', 'doze', 'slumber', 'hibernate', 'crash'],
    'talk': ['speak', 'chat', 'converse', 'discuss', 'communicate', 'gab'],
    'laugh': ['chuckle', 'giggle', 'snicker', 'cackle', 'guffaw', 'roar'],
    'cry': ['weep', 'sob', 'wail', 'bawl', 'tear', 'shed', 'tears'],
    'help': ['assist', 'aid', 'support', 'serve', 'aid', 'benefit'],
    'love': ['adore', 'cherish', 'treasure', 'admire', 'worship', 'fancy'],
    'hate': ['despise', 'loathe', 'detest', 'abhor', 'dislike', 'resent'],
    'know': ['understand', 'comprehend', 'grasp', 'realize', 'recognize', 'perceive'],
    'think': ['believe', 'consider', 'ponder', 'reflect', 'contemplate', 'reason'],
    'see': ['observe', 'notice', 'spot', 'detect', 'witness', 'perceive'],
    'hear': ['listen', 'attend', 'catch', 'perceive', 'detect'],
    'feel': ['sense', 'experience', 'perceive', 'touch', 'emote'],
    'smell': ['scent', 'odor', 'aroma', 'fragrance', 'whiff'],
    'taste': ['flavor', 'savor', 'sample', 'try']
  }
  
  // Expand description words with synonyms
  const expandedWords = [...descriptionWords]
  for (let i = 0; i < descriptionWords.length; i++) {
    const word = descriptionWords[i]
    if (synonymMap[word]) {
      expandedWords.push(...synonymMap[word])
    }
  }
  
  // N-gram analysis: detect word sequences (2-grams and 3-grams)
  const extractNgrams = (words: string[], n: number): string[] => {
    const ngrams: string[] = []
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(''))
    }
    return ngrams
  }
  
  const bigrams = extractNgrams(descriptionWords, 2)
  const trigrams = extractNgrams(descriptionWords, 3)
  
  // TF-IDF style weighting: calculate word importance
  const wordFrequency: Record<string, number> = {}
  for (let i = 0; i < descriptionWords.length; i++) {
    const word = descriptionWords[i]
    wordFrequency[word] = (wordFrequency[word] || 0) + 1
  }
  
  // Common words to downweight (stop words)
  const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that', 'with', 'they', 'from', 'what', 'when', 'there', 'would', 'more', 'about', 'which', 'their', 'will', 'than', 'then', 'them', 'like', 'time', 'just', 'very', 'into', 'your', 'some', 'could', 'such', 'were', 'other', 'each', 'so', 'only', 'also', 'new', 'make', 'first', 'being', 'after', 'should', 'work', 'get', 'most', 'a', 'an', 'is', 'in', 'it', 'to', 'of', 'on', 'at', 'by', 'or', 'as', 'if', 'my', 'his', 'its', 'who', 'him', 'he', 'she', 'her', 'we', 'us', 'me', 'be', 'do', 'did', 'does', 'go', 'went', 'gone']
  
  const wordImportance: Record<string, number> = {}
  for (const word in wordFrequency) {
    // TF component (frequency)
    const tf = wordFrequency[word]
    // IDF simulation (rare words get higher weight)
    const isStopWord = stopWords.indexOf(word) !== -1
    const idf = isStopWord ? 0.5 : 1.5
    wordImportance[word] = tf * idf
  }
  
  // Sentiment analysis: detect positive/negative/emotional words
  const sentimentWords: Record<string, string[]> = {
    positive: ['amazing', 'awesome', 'epic', 'insane', 'crazy', 'incredible', 'best', 'perfect', 'love', 'beautiful', 'stunning', 'fantastic', 'great', 'good', 'nice', 'cool', 'lit', 'fire', 'dope', 'sick', 'legendary', 'godlike', 'master', 'pro', 'skilled', 'talented'],
    negative: ['bad', 'terrible', 'awful', 'worst', 'hate', 'ugly', 'disgusting', 'fail', 'failed', 'mistake', 'error', 'wrong', 'broken', 'trash', 'garbage', 'stupid', 'dumb', 'idiotic', 'ridiculous', 'pathetic', 'weak', 'noob', 'beginner', 'amateur'],
    excitement: ['omg', 'wow', 'holy', 'shock', 'surprise', 'unbelievable', 'mindblowing', 'unreal', 'crazy', 'insane', 'epic', 'huge', 'massive', 'giant', 'colossal', 'enormous', 'infinite', 'limitless', 'ultimate', 'final', 'endgame'],
    action: ['kill', 'win', 'destroy', 'crush', 'dominate', 'smash', 'beat', 'defeat', 'conquer', 'capture', 'steal', 'rob', 'escape', 'survive', 'escape', 'rescue', 'save', 'protect', 'defend', 'attack', 'fight', 'battle', 'war'],
    calm: ['calm', 'peaceful', 'relaxed', 'chill', 'chilling', 'zen', 'meditation', 'meditate', 'serene', 'tranquil', 'quiet', 'silent', 'still', 'gentle', 'soft', 'mellow', 'soothing', 'comfortable', 'easy', 'slow', 'steady', 'balanced', 'harmonious', 'mindful', 'present', 'focused', 'centered', 'grounded', 'peace', 'silence', 'rest', 'resting', 'sleepy', 'cozy', 'warm', 'safe', 'secure'],
    curious: ['curious', 'interest', 'interesting', 'wonder', 'wondering', 'question', 'questions', 'ask', 'asking', 'explore', 'exploring', 'discover', 'discovery', 'learn', 'learning', 'study', 'studying', 'research', 'investigate', 'investigation', 'mystery', 'mysterious', 'unknown', 'secret', 'secrets', 'hidden', 'find', 'finding', 'search', 'searching', 'look', 'looking', 'seek', 'seeking', 'knowledge', 'information', 'facts', 'truth', 'answers', 'why', 'how', 'what', 'when', 'where', 'who'],
    nostalgic: ['nostalgic', 'nostalgia', 'memories', 'memory', 'remember', 'remembering', 'reminisce', 'reminiscing', 'flashback', 'flashbacks', 'old', 'old', 'school', 'classic', 'vintage', 'retro', 'past', 'childhood', 'kid', 'growing', 'up', 'back', 'then', 'those', 'days', 'good', 'old', 'days', 'times', 'era', 'decade', 'year', 'years', 'ago', 'used', 'to', 'miss', 'missing', 'wish', 'wishing', 'throwback', 'tbh', 'remember', 'when', 'the', 'good', 'times'],
    proud: ['proud', 'pride', 'accomplished', 'achievement', 'achieve', 'success', 'successful', 'victory', 'win', 'winner', 'champion', 'championship', 'trophy', 'medal', 'award', 'honored', 'honor', 'respect', 'respected', 'dignity', 'worthy', 'deserving', 'earned', 'deserve', 'worked', 'hard', 'effort', 'dedication', 'commitment', 'perseverance', 'overcome', 'challenge', 'challenges', 'obstacle', 'obstacles', 'goal', 'goals', 'dream', 'dreams', 'come', 'true', 'milestone', 'progress', 'improvement', 'growth', 'better', 'best', 'version', 'confident', 'confidence'],
    hopeful: ['hope', 'hopeful', 'hoping', 'optimistic', 'optimism', 'positive', 'positivity', 'believe', 'believing', 'belief', 'faith', 'trust', 'wish', 'wishing', 'dream', 'dreaming', 'aspire', 'aspiring', 'ambition', 'ambitious', 'future', 'tomorrow', 'someday', 'soon', 'eventually', 'possibility', 'possible', 'potential', 'chance', 'opportunity', 'bright', 'better', 'improve', 'improvement', 'change', 'changing', 'new', 'fresh', 'start', 'beginning', 'promise', 'promising', 'look', 'forward', 'anticipate', 'anticipation', 'expect', 'expecting', 'confidence', 'assure', 'assured', 'certain', 'sure']
  }
  
  let detectedSentiment: string | null = null
  const sentimentKeys = Object.keys(sentimentWords)
  for (let i = 0; i < sentimentKeys.length; i++) {
    const sentiment = sentimentKeys[i]
    const words = sentimentWords[sentiment]
    let matchCount = 0
    for (let j = 0; j < words.length; j++) {
      if (descLower.indexOf(words[j]) !== -1) matchCount++
    }
    if (matchCount >= 1) {
      detectedSentiment = sentiment
      break
    }
  }
  
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
    'overwatch': ['overwatch', 'ow', 'ow2', 'tracer', 'soldier', 'reaper', 'widowmaker', 'mercy', 'dva', 'reinhardt', 'zarya', 'genji', 'hanzo', 'junkrat', 'mei', 'torbjorn', 'winston', 'symmetra', 'pharah', 'ana', 'bastion', 'zenyatta', 'lucio', 'mccree', 'cassidy', 'sigma', 'wrecking', 'ball', 'ashe', 'baptiste', 'echo', 'sojourn', 'kiriko', 'ramattra', 'junker', 'queen', 'lifeweaver', 'venture', 'mauga'],
    'pubg': ['pubg', 'playerunknown', 'battlegrounds', 'erangel', 'miramar', 'sanhok', 'karakin', 'taego', 'deston', 'vikendi', 'drop', 'parachute', 'loot', 'crate', 'airdrop', 'zone', 'circle', 'blue', 'red', 'winner', 'chicken', 'dinner', 'kill', 'frag', 'm416', 'akm', 'awm', 'kar98k', 'pan', 'ugl', 'vehicle', 'car', 'buggy', 'boat', 'squad', 'duo', 'solo', 'rank', 'conqueror', 'ace', 'tier'],
    'csgo': ['csgo', 'cs2', 'counter', 'strike', 'global', 'offensive', 'dust2', 'mirage', 'inferno', 'nuke', 'overpass', 'cache', 'train', 'vertigo', 'ancient', 'anubis', 'awp', 'ak47', 'm4a4', 'm4a1s', 'deagle', 'usp', 'p250', 'fiveseven', 'tec9', 'glock', 'knife', 'defuse', 'plant', 'bomb', 't', 'ct', 'clutch', 'ace', 'rush', 'b', 'a', 'mid', 'eco', 'force', 'buy', 'full', 'save', 'rank', 'global', 'elite', 'faceit', 'esea', 'mm', 'premier', 'major', 'katowice', 'cologne', 'stockholm'],
    'dota2': ['dota', 'dota2', 'defense', 'ancients', 'mid', 'lane', 'support', 'carry', 'offlane', 'jungle', 'roam', 'gank', 'ward', 'stack', 'pull', 'creep', 'wave', 'tower', 'barracks', 'ancient', 'throne', 'roshan', 'aegis', 'cheese', 'rune', 'bounty', 'power', 'illusion', 'courier', 'tp', 'scroll', 'buyback', 'kill', 'death', 'assist', 'deny', 'last', 'hit', 'hook', 'pudge', 'invoker', 'meepo', 'arc', 'warden', 'primal', 'beast', 'manta', 'bkb', 'blink', 'daedalus', 'abyssal', 'rank', 'mmr', 'medal', 'divine', 'ancient', 'legend', 'archon', 'herald', 'guardian', 'crusader', 'immortal'],
    'r6': ['rainbow', 'six', 'siege', 'r6s', 'ubisoft', 'operator', 'defender', 'attacker', 'sledge', 'ash', 'thermite', 'thatcher', 'montagne', 'twitch', 'doc', 'rook', 'glaz', 'fuze', 'kapkan', 'blitz', 'iq', 'bandit', 'jager', 'mute', 'castle', 'pulse', 'valkyrie', 'caveira', 'frost', 'buck', 'blackbeard', 'capitao', 'hibana', 'echo', 'jackal', 'mira', 'lesion', 'ela', 'vigil', 'dokkaebi', 'zofia', 'lion', 'alibi', 'maestro', 'nomad', 'kaid', 'clash', 'maverick', 'mozzie', 'gridlock', 'nokk', 'warden', 'goyo', 'amaru', 'kali', 'wamai', 'ace', 'melusi', 'oryx', 'iana', 'zero', 'aruni', 'flores', 'thunderbird', 'azami', 'sens', 'tachanka', 'reinforce', 'barricade', 'drone', 'cam', 'camera', 'wall', 'breach', 'hatch', 'shield', 'gadget', 'ability', 'ult', 'ultimate', 'rank', 'diamond', 'platinum', 'gold', 'silver', 'bronze', 'copper', 'unranked', 'casual', 'quick', 'match', 'ranked', 'pro', 'league', 'major', 'six', 'invitational'],
    'destiny2': ['destiny', 'destiny2', 'd2', 'guardian', 'titan', 'hunter', 'warlock', 'light', 'darkness', 'stasis', 'strand', 'arc', 'solar', 'void', 'crucible', 'gambit', 'raid', 'dungeon', 'strike', 'nightfall', 'vanguard', 'savathun', 'xivu', 'arath', 'witness', 'traveler', 'ghost', 'exotic', 'legendary', 'rare', 'common', 'engram', 'loot', 'drop', 'world', 'drop', 'quest', 'mission', 'patrol', 'public', 'event', 'lost', 'sector', 'ascendant', 'challenge', 'pinnacle', 'craft', 'crafting', 'pattern', 'resonant', 'adept', 'master', 'grandmaster', 'trials', 'iron', 'banner', 'control', 'clash', 'rumble', 'mayhem', 'supremacy', 'lockdown', 'skirmish', 'elimination', 'survival', 'countdown', 'breakthrough', 'scavenger', 'zone', 'control', 'rift', 'dreadnaught', 'moon', 'europa', 'tangled', 'shore', 'dreaming', 'city', 'edz', 'cosmodrome', 'nessus', 'io', 'mars', 'mercury', 'titan', 'reef', 'tower', 'farm', 'grind', 'meta', 'pvp', 'pve', 'endgame', 'season', 'pass', 'artifact', 'mod', 'build', 'subclass', 'super', 'grenade', 'melee', 'class', 'ability', 'weapon', 'armor', 'ornament', 'shader', 'transmat', 'fast', 'travel', 'sparrow', 'ship', 'ghost', 'shell', 'emblem', 'title', 'seal', 'triumph', 'score', 'collection', 'vault', 'postmaster', 'eververse', 'silver', 'bright', 'dust', 'legend', 'mark', 'forsaken', 'shadowkeep', 'beyond', 'light', 'witch', 'queen', 'herald', 'final', 'shape', 'lightfall']
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
  
  // Activity/Non-game detection - identify lifestyle activities
  const activityKeywords: Record<string, string[]> = {
    'fitness': ['fitness', 'workout', 'gym', 'exercise', 'training', 'bodybuilding', 'muscle', 'strength', 'cardio', 'hiit', 'yoga', 'pilates', 'running', 'jogging', 'squat', 'deadlift', 'bench', 'press', 'lift', 'weight', 'health', 'wellness', 'healthy', 'diet', 'nutrition', 'protein', 'supplement', 'gains', 'shred', 'cut', 'bulk', 'personal', 'trainer', 'coach'],
    'cooking': ['cooking', 'cook', 'recipe', 'food', 'foodie', 'chef', 'kitchen', 'bake', 'baking', 'meal', 'dinner', 'lunch', 'breakfast', 'snack', 'dessert', 'cake', 'cookie', 'pizza', 'pasta', 'healthy', 'easy', 'quick', 'homemade', 'restaurant', 'cafe', 'delicious', 'tasty', 'yummy', 'eat', 'eating', 'mealprep', 'vegan', 'vegetarian'],
    'art': ['art', 'artist', 'artwork', 'drawing', 'paint', 'painting', 'sketch', 'design', 'digital', 'illustration', 'anime', 'manga', 'portrait', 'landscape', 'canvas', 'pencil', 'ink', 'watercolor', 'acrylic', 'oil', 'creative', 'creativity', 'aesthetic', 'aesthetics', 'style', 'artstyle', 'tutorial', 'process', 'wip', 'artdaily'],
    'music': ['music', 'song', 'singer', 'cover', 'acoustic', 'guitar', 'piano', 'drum', 'violin', 'beat', 'producer', 'production', 'remix', 'dj', 'concert', 'performance', 'band', 'album', 'track', 'release', 'listen', 'listening', 'playlist', 'spotify', 'soundcloud', 'apple', 'musician', 'artist', 'vocal', 'voice'],
    'travel': ['travel', 'trip', 'vacation', 'holiday', 'tour', 'tourist', 'destination', 'beach', 'mountain', 'city', 'country', 'explore', 'adventure', 'wanderlust', 'journey', 'roadtrip', 'flight', 'hotel', 'resort', 'airbnb', 'backpack', 'backpacking', 'solo', 'couple', 'family', 'guide', 'tips', 'vlog', 'travelvlog'],
    'sports': ['sport', 'sports', 'soccer', 'football', 'basketball', 'baseball', 'tennis', 'golf', 'swim', 'swimming', 'hockey', 'rugby', 'cricket', 'volleyball', 'badminton', 'boxing', 'mma', 'ufc', 'wwe', 'wrestling', 'athlete', 'team', 'player', 'match', 'game', 'championship', 'league', 'tournament', 'olympic', 'olympics'],
    'fashion': ['fashion', 'style', 'outfit', 'ootd', 'outfitoftheday', 'clothes', 'clothing', 'dress', 'shirt', 'jeans', 'shoes', 'sneakers', 'accessories', 'jewelry', 'makeup', 'beauty', 'skincare', 'hair', 'hairstyle', 'trend', 'trending', 'designer', 'brand', 'shopping', 'haul', 'lookbook', 'model', 'influencer'],
    'tech': ['tech', 'technology', 'gadget', 'phone', 'iphone', 'android', 'laptop', 'computer', 'pc', 'gamingpc', 'setup', 'desk', 'keyboard', 'mouse', 'monitor', 'headset', 'review', 'unboxing', 'comparison', 'apple', 'samsung', 'google', 'microsoft', 'software', 'app', 'application', 'coding', 'programming', 'developer', 'code'],
    'pets': ['pet', 'dog', 'cat', 'puppy', 'kitten', 'cute', 'adorable', 'animal', 'vet', 'vetlife', 'petlife', 'dogsofinstagram', 'catsofinstagram', 'petlover', 'adopt', 'rescue', 'shelter', 'breed', 'training', 'trick', 'funny', 'cuteanimals', 'furry', 'furfriend'],
    'lifestyle': ['lifestyle', 'morning', 'routine', 'night', 'day', 'daily', 'vlog', 'vlogger', 'life', 'living', 'home', 'house', 'apartment', 'room', 'bedroom', 'decor', 'decoration', 'organization', 'clean', 'cleaning', 'productivity', 'motivation', 'inspiration', 'goals', 'habit', 'selfcare', 'mentalhealth'],
    'streaming': ['stream', 'streaming', 'live', 'streamer', 'broadcast', 'livestream', 'go', 'live', 'live', 'now', 'chat', 'chatting', 'community', 'viewer', 'viewers', 'audience', 'follower', 'followers', 'sub', 'subs', 'subscriber', 'subscribers', 'donate', 'donation', 'tip', 'tips', 'bits', 'cheers', 'gift', 'support', 'patron', 'patreon', 'membership', 'emote', 'emotes', 'emoji', 'reaction', 'raid', 'raiding', 'host', 'hosting', 'collab', 'collaboration', 'overlay', 'alert', 'goal', 'milestone', 'giveaway', 'tournament', 'obs', 'twitch', 'kick', 'youtube', 'facebook', 'trovo', 'mod', 'moderator', 'admin', 'partner', 'affiliate', 'bot', 'charity', 'fundraiser', 'podcast', 'interview', 'qanda', 'ama', 'panel', 'discussion', 'news', 'update', 'event', 'marathon', '24hour', 'setup', 'tech', 'equipment', 'webcam', 'microphone', 'lighting'],
    'education': ['education', 'learn', 'learning', 'study', 'studying', 'school', 'college', 'university', 'student', 'students', 'teacher', 'professor', 'class', 'course', 'lesson', 'tutorial', 'lecture', 'exam', 'test', 'quiz', 'homework', 'assignment', 'project', 'research', 'thesis', 'dissertation', 'degree', 'diploma', 'certificate', 'online', 'course', 'mooc', 'skill', 'skills', 'knowledge', 'academic', 'scholarship', 'graduation', 'graduate'],
    'diy': ['diy', 'do', 'it', 'yourself', 'craft', 'crafts', 'handmade', 'homemade', 'project', 'projects', 'build', 'building', 'make', 'making', 'create', 'creating', 'fix', 'repair', 'restore', 'upcycle', 'repurpose', 'hack', 'lifehack', 'tips', 'tricks', 'tutorial', 'howto', 'guide', 'woodworking', 'sewing', 'knitting', 'crochet', 'embroidery', 'jewelry', 'making', 'pottery', 'ceramics', 'scrapbooking', 'origami', 'calligraphy'],
    'photography': ['photography', 'photo', 'photographer', 'camera', 'lens', 'shoot', 'shooting', 'portrait', 'landscape', 'street', 'nature', 'wildlife', 'wedding', 'event', 'studio', 'editing', 'edit', 'lightroom', 'photoshop', 'preset', 'filter', 'composition', 'exposure', 'aperture', 'shutter', 'iso', 'focus', 'depth', 'field', 'bokeh', 'drone', 'aerial', 'cinematography', 'videography', 'video', 'film', 'analog', 'digital', 'mirrorless', 'dslr', 'instant', 'polaroid'],
    'finance': ['finance', 'money', 'financial', 'invest', 'investing', 'investment', 'stock', 'stocks', 'trading', 'trader', 'market', 'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'budget', 'budgeting', 'save', 'saving', 'savings', 'debt', 'credit', 'loan', 'bank', 'banking', 'account', 'wealth', 'rich', 'income', 'passive', 'income', 'side', 'hustle', 'entrepreneur', 'business', 'startup', 'economy', 'tax', 'retirement', 'pension', 'insurance', 'real', 'estate', 'property'],
    'entertainment': ['entertainment', 'movie', 'movies', 'film', 'films', 'cinema', 'tv', 'television', 'show', 'shows', 'series', 'episode', 'netflix', 'hulu', 'disney', 'plus', 'amazon', 'prime', 'hbo', 'max', 'anime', 'animation', 'cartoon', 'comedy', 'drama', 'horror', 'thriller', 'action', 'sci-fi', 'fantasy', 'romance', 'documentary', 'reality', 'tv', 'celebrity', 'actor', 'actress', 'director', 'producer', 'review', 'trailer', 'spoiler', 'binge', 'watch', 'watching']
  }
  
  // Subject detection - identify animals, nature, objects, scenarios
  const subjectKeywords: Record<string, string[]> = {
    'animals': ['animal', 'animals', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'puppies', 'cat', 'cats', 'kitten', 'kittens', 'frog', 'frogs', 'toad', 'toads', 'bird', 'birds', 'fish', 'fishes', 'wildlife', 'wild', 'creature', 'creatures', 'beast', 'beasts', 'insect', 'insects', 'bug', 'bugs', 'butterfly', 'butterflies', 'spider', 'spiders', 'snake', 'snakes', 'lizard', 'lizards', 'turtle', 'turtles', 'rabbit', 'rabbits', 'hamster', 'hamsters', 'guinea', 'pig', 'horse', 'horses', 'cow', 'cows', 'pig', 'pigs', 'sheep', 'goat', 'goats', 'chicken', 'chickens', 'duck', 'ducks', 'mouse', 'mice', 'rat', 'rats', 'lion', 'tigers', 'bear', 'bears', 'elephant', 'elephants', 'monkey', 'monkeys', 'ape', 'apes', 'zoo', 'aquarium'],
    'nature': ['nature', 'natural', 'outdoor', 'outdoors', 'forest', 'forests', 'tree', 'trees', 'wood', 'woods', 'jungle', 'pond', 'ponds', 'lake', 'lakes', 'river', 'rivers', 'ocean', 'oceans', 'sea', 'seas', 'beach', 'beaches', 'mountain', 'mountains', 'hill', 'hills', 'valley', 'valleys', 'sky', 'cloud', 'clouds', 'sun', 'moon', 'star', 'stars', 'rain', 'snow', 'wind', 'storm', 'thunder', 'lightning', 'sunset', 'sunrise', 'dawn', 'dusk', 'twilight', 'night', 'day', 'weather', 'season', 'seasons', 'spring', 'summer', 'autumn', 'fall', 'winter', 'flower', 'flowers', 'plant', 'plants', 'grass', 'leaf', 'leaves', 'garden', 'park', 'water', 'fire', 'earth', 'soil', 'dirt', 'sand', 'rock', 'rocks', 'stone', 'stones'],
    'scenarios': ['talking', 'talk', 'conversation', 'conversations', 'chat', 'chats', 'speaking', 'speak', 'voice', 'voices', 'saying', 'said', 'says', 'dancing', 'dance', 'dancer', 'dancers', 'singing', 'sing', 'singer', 'song', 'playing', 'play', 'player', 'running', 'run', 'runner', 'walking', 'walk', 'walker', 'swimming', 'swim', 'swimmer', 'flying', 'fly', 'flight', 'jumping', 'jump', 'eating', 'eat', 'drinking', 'drink', 'sleeping', 'sleep', 'fighting', 'fight', 'fighting', 'arguing', 'argue', 'laughing', 'laugh', 'crying', 'cry', 'smiling', 'smile', 'screaming', 'scream', 'shouting', 'shout', 'whispering', 'whisper', 'yelling', 'yell', 'kissing', 'kiss', 'hugging', 'hug', 'holding', 'hold', 'sitting', 'sit', 'standing', 'stand', 'lying', 'lie', 'laying', 'lay', 'falling', 'fall', 'rising', 'rise', 'climbing', 'climb'],
    'objects': ['car', 'cars', 'vehicle', 'vehicles', 'truck', 'trucks', 'bus', 'buses', 'train', 'trains', 'plane', 'planes', 'boat', 'boats', 'ship', 'ships', 'bicycle', 'bicycle', 'bike', 'bikes', 'motorcycle', 'motorcycles', 'house', 'home', 'homes', 'building', 'buildings', 'apartment', 'apartments', 'room', 'rooms', 'door', 'doors', 'window', 'windows', 'wall', 'walls', 'floor', 'floors', 'ceiling', 'ceilings', 'roof', 'roofs', 'furniture', 'chair', 'chairs', 'table', 'tables', 'bed', 'beds', 'sofa', 'sofas', 'couch', 'couches', 'desk', 'desks', 'shelf', 'shelves', 'lamp', 'lamps', 'light', 'lights', 'phone', 'phones', 'computer', 'computers', 'laptop', 'laptops', 'television', 'tv', 'television', 'television', 'screen', 'screens', 'camera', 'cameras', 'watch', 'watches', 'clock', 'clocks', 'mirror', 'mirrors', 'glass', 'cup', 'cups', 'plate', 'plates', 'bowl', 'bowls', 'fork', 'forks', 'spoon', 'spoons', 'knife', 'knives', 'book', 'books', 'pen', 'pens', 'pencil', 'pencils', 'paper', 'papers', 'bag', 'bags', 'box', 'boxes', 'bottle', 'bottles', 'can', 'cans', 'jar', 'jars'],
    'people': ['people', 'person', 'human', 'humans', 'man', 'men', 'woman', 'women', 'boy', 'boys', 'girl', 'girls', 'kid', 'kids', 'child', 'children', 'baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'teen', 'teens', 'teenager', 'teenagers', 'adult', 'adults', 'elderly', 'senior', 'seniors', 'old', 'young', 'family', 'families', 'friend', 'friends', 'couple', 'couples', 'group', 'groups', 'crowd', 'crowds', 'audience', 'audiences', 'stranger', 'strangers', 'neighbor', 'neighbors', 'colleague', 'colleagues', 'coworker', 'coworkers', 'boss', 'bosses', 'teacher', 'teachers', 'student', 'students', 'doctor', 'doctors', 'nurse', 'nurses', 'police', 'officer', 'officers', 'soldier', 'soldiers', 'actor', 'actors', 'actress', 'actresses', 'singer', 'singers', 'dancer', 'dancers', 'artist', 'artists', 'writer', 'writers', 'author', 'authors'],
    'emotions': ['happy', 'happiness', 'joy', 'joyful', 'sad', 'sadness', 'unhappy', 'angry', 'anger', 'mad', 'furious', 'excited', 'excitement', 'thrilled', 'scared', 'scare', 'fear', 'afraid', 'terrified', 'surprised', 'surprise', 'shocked', 'love', 'loving', 'hate', 'hating', 'dislike', 'funny', 'humor', 'humorous', 'serious', 'dramatic', 'emotional', 'feel', 'feeling', 'feelings', 'mood', 'moods', 'calm', 'peaceful', 'relaxed', 'stressed', 'worried', 'anxious', 'nervous', 'confident', 'proud', 'embarrassed', 'ashamed', 'guilty', 'jealous', 'envious', 'grateful', 'thankful', 'hopeful', 'hope', 'desperate', 'lonely', 'alone', 'bored', 'boring', 'interested', 'curious', 'confused', 'puzzled', 'amazed', 'impressed', 'disappointed', 'proud', 'satisfied', 'content'],
    'food': ['food', 'foods', 'meal', 'meals', 'dish', 'dishes', 'cuisine', 'recipe', 'recipes', 'ingredient', 'ingredients', 'cooking', 'cook', 'baking', 'bake', 'fried', 'grilled', 'roasted', 'boiled', 'steamed', 'raw', 'fresh', 'organic', 'healthy', 'unhealthy', 'junk', 'fast', 'food', 'snack', 'snacks', 'drink', 'drinks', 'beverage', 'beverages', 'water', 'juice', 'soda', 'coffee', 'tea', 'milk', 'beer', 'wine', 'alcohol', 'cocktail', 'breakfast', 'lunch', 'dinner', 'supper', 'dessert', 'sweet', 'salty', 'spicy', 'sour', 'bitter', 'delicious', 'tasty', 'yummy', 'flavor', 'taste', 'eat', 'eating', 'drink', 'drinking', 'restaurant', 'cafe', 'diner', 'bar', 'pub', 'grocery', 'market', 'supermarket', 'fruit', 'fruits', 'vegetable', 'vegetables', 'meat', 'fish', 'seafood', 'chicken', 'beef', 'pork', 'lamb', 'bread', 'pasta', 'rice', 'pizza', 'burger', 'sandwich', 'salad', 'soup', 'cake', 'cookie', 'pie', 'ice', 'cream', 'chocolate', 'candy', 'sugar', 'salt', 'pepper', 'sauce', 'ketchup', 'mustard', 'mayo', 'cheese', 'butter', 'oil', 'egg', 'eggs'],
    'technology': ['technology', 'tech', 'digital', 'electronic', 'electronics', 'device', 'devices', 'gadget', 'gadgets', 'smartphone', 'phone', 'iphone', 'android', 'tablet', 'ipad', 'laptop', 'computer', 'pc', 'desktop', 'monitor', 'screen', 'keyboard', 'mouse', 'trackpad', 'webcam', 'microphone', 'speaker', 'headphones', 'headset', 'earbuds', 'camera', 'drone', 'robot', 'ai', 'artificial', 'intelligence', 'machine', 'learning', 'software', 'app', 'application', 'program', 'programming', 'coding', 'code', 'developer', 'developer', 'internet', 'web', 'website', 'online', 'wifi', 'bluetooth', 'usb', 'cable', 'wire', 'wireless', 'battery', 'charger', 'power', 'adapter', 'memory', 'storage', 'hard', 'drive', 'ssd', 'ram', 'cpu', 'processor', 'gpu', 'graphics', 'card', 'motherboard', 'chip', 'circuit', 'board', 'virtual', 'reality', 'vr', 'ar', 'augmented', 'reality', 'metaverse', 'blockchain', 'crypto', 'cryptocurrency', 'bitcoin', 'nft', 'smart', 'contract', 'cloud', 'computing', 'server', 'data', 'database', 'network', 'cybersecurity', 'hacker', 'hacking', 'cyber', 'attack', 'malware', 'virus', 'firewall', 'encryption', 'password', 'security', 'privacy', 'biometric', 'fingerprint', 'face', 'recognition', 'voice', 'recognition'],
    'vehicles': ['vehicle', 'vehicles', 'car', 'cars', 'automobile', 'automobiles', 'truck', 'trucks', 'suv', 'van', 'vans', 'bus', 'buses', 'motorcycle', 'motorcycles', 'bike', 'bicycle', 'bicycles', 'scooter', 'scooters', 'moped', 'train', 'trains', 'subway', 'metro', 'tram', 'trolley', 'plane', 'airplane', 'airplanes', 'aircraft', 'jet', 'helicopter', 'helicopters', 'drone', 'drones', 'boat', 'boats', 'ship', 'ships', 'yacht', 'yachts', 'sailboat', 'cruise', 'ferry', 'raft', 'kayak', 'canoe', 'rocket', 'spacecraft', 'spaceship', 'satellite', 'ambulance', 'police', 'car', 'fire', 'truck', 'taxi', 'cab', 'uber', 'lyft', 'rideshare', 'rental', 'lease', 'dealership', 'garage', 'parking', 'traffic', 'road', 'highway', 'street', 'intersection', 'highway', 'freeway', 'interstate', 'bridge', 'tunnel', 'gas', 'station', 'fuel', 'petrol', 'diesel', 'electric', 'hybrid', 'engine', 'motor', 'transmission', 'brake', 'brakes', 'tire', 'tires', 'wheel', 'wheels', 'steering', 'wheel', 'dashboard', 'seat', 'seatbelt', 'airbag', 'speed', 'velocity', 'acceleration', 'mileage', 'mpg', 'gps', 'navigation', 'autonomous', 'self', 'driving', 'driver', 'driverless'],
    'locations': ['location', 'locations', 'place', 'places', 'spot', 'spots', 'area', 'areas', 'region', 'regions', 'zone', 'zones', 'district', 'districts', 'neighborhood', 'neighborhoods', 'city', 'cities', 'town', 'towns', 'village', 'villages', 'country', 'countries', 'nation', 'nations', 'state', 'states', 'province', 'provinces', 'territory', 'territories', 'continent', 'continents', 'island', 'islands', 'beach', 'beaches', 'coast', 'coastline', 'shore', 'shoreline', 'harbor', 'harbour', 'port', 'ports', 'airport', 'airports', 'station', 'stations', 'terminal', 'terminals', 'building', 'buildings', 'structure', 'structures', 'landmark', 'landmarks', 'monument', 'monuments', 'museum', 'museums', 'gallery', 'galleries', 'library', 'libraries', 'school', 'schools', 'university', 'universities', 'college', 'colleges', 'hospital', 'hospitals', 'clinic', 'clinics', 'church', 'churches', 'temple', 'temples', 'mosque', 'mosques', 'synagogue', 'synagogues', 'cathedral', 'cathedrals', 'castle', 'castles', 'palace', 'palaces', 'fort', 'fortress', 'ruins', 'ancient', 'historical', 'modern', 'downtown', 'uptown', 'suburb', 'suburbs', 'rural', 'urban', 'metropolitan', 'capital', 'headquarters', 'office', 'offices', 'factory', 'factories', 'warehouse', 'warehouses', 'store', 'stores', 'shop', 'shops', 'mall', 'malls', 'market', 'markets', 'plaza', 'square', 'park', 'parks', 'garden', 'gardens', 'stadium', 'stadiums', 'arena', 'arenas', 'theater', 'theatre', 'cinema', 'movie', 'theater'],
    'weather': ['weather', 'climate', 'temperature', 'hot', 'cold', 'warm', 'cool', 'freezing', 'boiling', 'chilly', 'mild', 'humid', 'dry', 'wet', 'rain', 'raining', 'rainy', 'shower', 'storm', 'thunderstorm', 'lightning', 'thunder', 'snow', 'snowing', 'snowy', 'blizzard', 'flurry', 'sleet', 'hail', 'hailstorm', 'ice', 'icy', 'frost', 'fog', 'foggy', 'mist', 'misty', 'haze', 'smog', 'cloud', 'cloudy', 'clouds', 'overcast', 'clear', 'sunny', 'sunshine', 'bright', 'gloomy', 'dark', 'wind', 'windy', 'breeze', 'gust', 'hurricane', 'typhoon', 'cyclone', 'tornado', 'twister', 'flood', 'flooded', 'drought', 'heatwave', 'cold', 'wave', 'forecast', 'prediction', 'meteorology', 'atmosphere', 'pressure', 'barometer', 'humidity', 'dew', 'point', 'visibility', 'uv', 'index', 'sunburn', 'shade', 'umbrella', 'raincoat', 'jacket', 'coat', 'sweater', 'boots', 'seasonal', 'spring', 'summer', 'autumn', 'fall', 'winter', 'monsoon', 'equinox', 'solstice', 'eclipse', 'aurora', 'rainbow', 'sunset', 'sunrise', 'dawn', 'dusk', 'twilight', 'daylight', 'daytime', 'nighttime', 'midnight', 'noon', 'afternoon', 'evening', 'morning']
  }
  
  // Detect the primary activity by counting keyword matches
  let detectedActivity: string | null = null
  let maxActivityScore = 0
  
  const activityKeys = Object.keys(activityKeywords)
  for (let i = 0; i < activityKeys.length; i++) {
    const activity = activityKeys[i]
    const keywords = activityKeywords[activity]
    let activityScore = 0
    for (let j = 0; j < keywords.length; j++) {
      if (descLower.indexOf(keywords[j]) !== -1) {
        activityScore += 1
      }
    }
    if (activityScore > maxActivityScore && activityScore >= 1) {
      maxActivityScore = activityScore
      detectedActivity = activity
    }
  }
  
  // Detect the primary subject by counting keyword matches
  let detectedSubject: string | null = null
  let maxSubjectScore = 0
  
  const subjectKeys = Object.keys(subjectKeywords)
  for (let i = 0; i < subjectKeys.length; i++) {
    const subject = subjectKeys[i]
    const keywords = subjectKeywords[subject]
    let subjectScore = 0
    for (let j = 0; j < keywords.length; j++) {
      if (descLower.indexOf(keywords[j]) !== -1) {
        subjectScore += 1
      }
    }
    if (subjectScore > maxSubjectScore && subjectScore >= 1) {
      maxSubjectScore = subjectScore
      detectedSubject = subject
    }
  }
  
  // Content type detection (separate from game/activity detection)
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
  
  // Dynamic weight adjustment based on input characteristics
  const inputLength = descriptionWords.length
  const inputComplexity = expandedWords.length / descriptionWords.length
  const hasDetectedGame = detectedGame !== null
  const hasDetectedActivity = detectedActivity !== null
  const hasDetectedSubject = detectedSubject !== null
  const sentimentDetected = detectedSentiment !== null
  
  // Adjust weights based on input characteristics
  let ngramWeight = 0.25
  let positionWeight = 0.20
  let semanticWeight = 0.15
  let sentimentWeight = 0.10
  let contextWeight = 0.20
  let contentTypeWeight = 0.10
  
  // For short descriptions, boost exact matches and n-grams
  if (inputLength < 5) {
    ngramWeight = 0.35
    positionWeight = 0.25
    semanticWeight = 0.10
    contextWeight = 0.15
  }
  // For long descriptions, boost semantic and contextual understanding
  else if (inputLength > 20) {
    ngramWeight = 0.15
    positionWeight = 0.15
    semanticWeight = 0.25
    contextWeight = 0.25
  }
  
  // If game detected, boost contextual relevance
  if (hasDetectedGame) {
    contextWeight += 0.10
    ngramWeight -= 0.05
  }
  // If activity detected, boost semantic understanding
  if (hasDetectedActivity) {
    semanticWeight += 0.05
    contextWeight += 0.05
    ngramWeight -= 0.05
  }
  // If sentiment detected, boost sentiment alignment
  if (sentimentDetected) {
    sentimentWeight += 0.05
    semanticWeight -= 0.03
  }
  
  // Tag co-occurrence analysis - related tags that often appear together
  const coOccurrenceMap: Record<string, string[]> = {
    'fortnite': ['battle royale', 'royale', 'battle', 'build', 'victory', 'epic games', 'chapter', 'season'],
    'minecraft': ['survival', 'creative', 'building', 'blocks', 'craft', 'mining', 'redstone'],
    'valorant': ['fps', 'tactical', 'shooter', 'agent', 'riot games', 'competitive', 'ranked'],
    'gta': ['open world', 'crime', 'heist', 'rockstar', 'los santos', 'online', 'roleplay'],
    'apex': ['battle royale', 'legends', 'respawn', 'ea', 'apex legends', 'season', 'rank'],
    'league': ['moba', 'riot games', 'champion', 'lane', 'jungle', 'ranked', 'esports'],
    'roblox': ['obby', 'tycoon', 'simulator', 'blox', 'games', 'avatar', 'platform'],
    'genshin': ['anime', 'gacha', 'rpg', 'mihoyo', 'teyvat', 'element', 'vision'],
    'overwatch': ['fps', 'blizzard', 'hero', 'shooter', 'team', 'competitive', 'esports'],
    'pubg': ['battle royale', 'survival', 'shooter', 'tencent', 'erangel', 'squad', 'duo'],
    'csgo': ['fps', 'shooter', 'valve', 'competitive', 'ranked', 'terrorist', 'counter'],
    'dota2': ['moba', 'valve', 'rpg', 'lane', 'jungle', 'ranked', 'esports'],
    'r6': ['fps', 'ubisoft', 'tactical', 'shooter', 'operator', 'siege', 'ranked'],
    'destiny2': ['fps', 'bungie', 'looter', 'shooter', 'raid', 'strike', 'guardian'],
    'streaming': ['live', 'streamer', 'twitch', 'kick', 'broadcast', 'chat', 'community'],
    'gaming': ['game', 'games', 'gamer', 'play', 'esports', 'competitive', 'multiplayer'],
    'fitness': ['workout', 'gym', 'exercise', 'health', 'training', 'muscle', 'cardio'],
    'cooking': ['food', 'recipe', 'chef', 'kitchen', 'meal', 'bake', 'homemade'],
    'music': ['song', 'audio', 'beat', 'artist', 'concert', 'band', 'playlist'],
    'travel': ['vacation', 'trip', 'adventure', 'explore', 'destination', 'tour', 'journey'],
    'tech': ['technology', 'gadget', 'device', 'software', 'app', 'digital', 'computer'],
    'fashion': ['style', 'outfit', 'clothing', 'trend', 'designer', 'beauty', 'model'],
    'education': ['learn', 'study', 'school', 'knowledge', 'tutorial', 'course', 'skill'],
    'diy': ['craft', 'build', 'create', 'handmade', 'project', 'tutorial', 'howto'],
    'photography': ['photo', 'camera', 'picture', 'shoot', 'lens', 'edit', 'visual'],
    'finance': ['money', 'invest', 'crypto', 'trading', 'business', 'wealth', 'income']
  }
  
  // Word embedding similarity using co-occurrence vectors
  const wordCoOccurrence: Record<string, string[]> = {
    'game': ['play', 'gaming', 'match', 'competitive', 'esports', 'multiplayer', 'online', 'video', 'console', 'pc'],
    'video': ['clip', 'content', 'footage', 'recording', 'stream', 'upload', 'youtube', 'tiktok', 'viral', 'edit'],
    'music': ['song', 'audio', 'beat', 'rhythm', 'melody', 'artist', 'band', 'concert', 'playlist', 'sound'],
    'food': ['cook', 'recipe', 'meal', 'dish', 'eat', 'restaurant', 'chef', 'kitchen', 'bake', 'taste'],
    'travel': ['trip', 'vacation', 'journey', 'adventure', 'explore', 'destination', 'tour', 'flight', 'hotel', 'visit'],
    'fitness': ['workout', 'exercise', 'gym', 'health', 'training', 'muscle', 'cardio', 'strength', 'yoga', 'run'],
    'tech': ['technology', 'gadget', 'device', 'software', 'app', 'digital', 'computer', 'phone', 'internet', 'smart'],
    'fashion': ['style', 'outfit', 'clothing', 'wear', 'trend', 'designer', 'brand', 'look', 'beauty', 'model'],
    'funny': ['hilarious', 'comedy', 'laugh', 'joke', 'humor', 'meme', 'lol', 'haha', 'entertaining', 'amusing'],
    'cool': ['awesome', 'amazing', 'epic', 'great', 'nice', 'impressive', 'dope', 'sick', 'rad', 'fantastic']
  }
  
  // Score each tag with advanced multi-factor NLP-based logic
  const scoredTags = platformTags.map(tag => {
    let score = 0
    const tagLower = tag.toLowerCase()
    
    // Factor 1: N-gram matching (highest weight - 0.25)
    let ngramScore = 0
    for (let i = 0; i < trigrams.length; i++) {
      if (tagLower === trigrams[i]) ngramScore += 60
      else if (tagLower.indexOf(trigrams[i]) !== -1) ngramScore += 40
    }
    for (let i = 0; i < bigrams.length; i++) {
      if (tagLower === bigrams[i]) ngramScore += 50
      else if (tagLower.indexOf(bigrams[i]) !== -1) ngramScore += 35
    }
    score += ngramScore * ngramWeight
    
    // Factor 2: Word position and context (0.20)
    let positionScore = 0
    for (let i = 0; i < wordFeatures.length; i++) {
      const feature = wordFeatures[i]
      if (tagLower === feature.word) {
        if (feature.isStart) positionScore += 35
        else if (feature.isEnd) positionScore += 30
        else positionScore += 25
      } else if (tagLower.indexOf(feature.word) !== -1) {
        if (feature.isStart) positionScore += 20
        else if (feature.isEnd) positionScore += 18
        else positionScore += 15
      } else if (feature.word.indexOf(tagLower) !== -1 && tagLower.length > 3) {
        positionScore += 8
      }
    }
    score += positionScore * positionWeight
    
    // Factor 3: Semantic similarity - word overlap ratio (0.15)
    let semanticScore = 0
    const tagWords = tagLower.replace(/[^a-z0-9]/g, '').split(/(?=[A-Z])|(?=[0-9])/).filter(w => w.length > 2)
    let overlapCount = 0
    for (let i = 0; i < tagWords.length; i++) {
      for (let j = 0; j < descriptionWords.length; j++) {
        if (tagWords[i] === descriptionWords[j]) overlapCount++
      }
    }
    if (tagWords.length > 0) {
      const overlapRatio = overlapCount / tagWords.length
      semanticScore += overlapRatio * 50
    }
    score += semanticScore * semanticWeight
    
    // Factor 4: Sentiment alignment (0.10)
    let sentimentScore = 0
    if (detectedSentiment) {
      if (detectedSentiment === 'positive') {
        if (['epic', 'amazing', 'awesome', 'best', 'top', 'pro', 'master', 'legendary', 'godlike', 'insane', 'crazy'].some(s => tagLower.indexOf(s) !== -1)) sentimentScore += 20
      } else if (detectedSentiment === 'negative') {
        if (['fail', 'worst', 'bad', 'trash', 'garbage', 'noob', 'beginner', 'amateur'].some(s => tagLower.indexOf(s) !== -1)) sentimentScore += 20
      } else if (detectedSentiment === 'excitement') {
        if (['viral', 'trending', 'epic', 'insane', 'crazy', 'huge', 'massive', 'ultimate', 'mindblowing'].some(s => tagLower.indexOf(s) !== -1)) sentimentScore += 20
      } else if (detectedSentiment === 'action') {
        if (['kill', 'win', 'destroy', 'crush', 'dominate', 'smash', 'beat', 'defeat', 'conquer', 'clutch', 'ace'].some(s => tagLower.indexOf(s) !== -1)) sentimentScore += 20
      }
    }
    score += sentimentScore * sentimentWeight
    
    // Factor 5: Tag length optimization (0.05)
    let lengthScore = 0
    if (tagLower.length >= 5 && tagLower.length <= 15) lengthScore += 10
    else if (tagLower.length >= 3 && tagLower.length <= 20) lengthScore += 5
    else if (tagLower.length > 25) lengthScore -= 5
    score += lengthScore * 0.05
    
    // Factor 6: Tag uniqueness/diversity (0.05)
    let uniquenessScore = 0
    const tagCharSet = new Set(tagLower.split(''))
    const uniqueRatio = tagCharSet.size / tagLower.length
    if (uniqueRatio > 0.7) uniquenessScore += 5
    score += uniquenessScore * 0.05
    
    // Factor 7: Contextual relevance - game/activity/subject (0.20)
    let contextScore = 0
    if (detectedGame) {
      if (tagLower.indexOf(detectedGame) !== -1) contextScore += 50
      const gameSpecificKeywords = gameKeywords[detectedGame] || []
      for (let i = 0; i < gameSpecificKeywords.length; i++) {
        if (tagLower.indexOf(gameSpecificKeywords[i]) !== -1) contextScore += 25
      }
      for (let i = 0; i < gameKeys.length; i++) {
        const otherGame = gameKeys[i]
        if (otherGame !== detectedGame && tagLower.indexOf(otherGame) !== -1) contextScore -= 100
      }
      for (let i = 0; i < activityKeys.length; i++) {
        if (tagLower.indexOf(activityKeys[i]) !== -1) contextScore -= 50
      }
      for (let i = 0; i < subjectKeys.length; i++) {
        if (tagLower.indexOf(subjectKeys[i]) !== -1) contextScore -= 30
      }
    } else if (detectedActivity) {
      if (tagLower.indexOf(detectedActivity) !== -1) contextScore += 50
      const activitySpecificKeywords = activityKeywords[detectedActivity] || []
      for (let i = 0; i < activitySpecificKeywords.length; i++) {
        if (tagLower.indexOf(activitySpecificKeywords[i]) !== -1) contextScore += 25
      }
      for (let i = 0; i < activityKeys.length; i++) {
        const otherActivity = activityKeys[i]
        if (otherActivity !== detectedActivity && tagLower.indexOf(otherActivity) !== -1) contextScore -= 100
      }
      for (let i = 0; i < gameKeys.length; i++) {
        if (tagLower.indexOf(gameKeys[i]) !== -1) contextScore -= 50
      }
    } else if (detectedSubject) {
      if (tagLower.indexOf(detectedSubject) !== -1) contextScore += 50
      const subjectSpecificKeywords = subjectKeywords[detectedSubject] || []
      for (let i = 0; i < subjectSpecificKeywords.length; i++) {
        if (tagLower.indexOf(subjectSpecificKeywords[i]) !== -1) contextScore += 25
      }
      for (let i = 0; i < subjectKeys.length; i++) {
        const otherSubject = subjectKeys[i]
        if (otherSubject !== detectedSubject && tagLower.indexOf(otherSubject) !== -1) contextScore -= 100
      }
      for (let i = 0; i < gameKeys.length; i++) {
        if (tagLower.indexOf(gameKeys[i]) !== -1) contextScore -= 50
      }
    }
    score += contextScore * contextWeight
    
    // Factor 8: Content type alignment (0.10)
    let contentTypeScore = 0
    if (detectedContentTypes.indexOf('editing') !== -1) {
      if (tagLower.indexOf('edit') !== -1 || tagLower.indexOf('montage') !== -1 || tagLower.indexOf('clip') !== -1) contentTypeScore += 15
    }
    if (detectedContentTypes.indexOf('funny') !== -1) {
      if (tagLower.indexOf('funny') !== -1 || tagLower.indexOf('meme') !== -1 || tagLower.indexOf('lol') !== -1 || tagLower.indexOf('fail') !== -1) contentTypeScore += 15
    }
    if (detectedContentTypes.indexOf('tutorial') !== -1) {
      if (tagLower.indexOf('tutorial') !== -1 || tagLower.indexOf('guide') !== -1 || tagLower.indexOf('tips') !== -1 || tagLower.indexOf('howto') !== -1) contentTypeScore += 15
    }
    if (detectedContentTypes.indexOf('reaction') !== -1) {
      if (tagLower.indexOf('react') !== -1 || tagLower.indexOf('duet') !== -1 || tagLower.indexOf('stitch') !== -1) contentTypeScore += 15
    }
    score += contentTypeScore * contentTypeWeight
    
    // Factor 9: Platform alignment (0.05)
    let platformScore = 0
    if (tagLower.indexOf(platform.toLowerCase().replace('-', '')) !== -1) platformScore += 10
    score += platformScore * 0.05
    
    // Factor 10: Viral potential (0.05)
    let viralScore = 0
    if (tagLower.indexOf('viral') !== -1 || tagLower.indexOf('trending') !== -1 || tagLower.indexOf('fyp') !== -1 || tagLower.indexOf('foryou') !== -1 || tagLower.indexOf('explore') !== -1) viralScore += 5
    score += viralScore * 0.05
    
    // Factor 11: Context window analysis (0.08) - analyze words around matches
    let contextWindowScore = 0
    const windowSize = 3
    for (let i = 0; i < descriptionWords.length; i++) {
      if (tagLower.indexOf(descriptionWords[i]) !== -1) {
        // Check words before and after
        for (let w = Math.max(0, i - windowSize); w <= Math.min(descriptionWords.length - 1, i + windowSize); w++) {
          if (w !== i && tagLower.indexOf(descriptionWords[w]) !== -1) {
            contextWindowScore += 8
          }
        }
      }
    }
    score += contextWindowScore * 0.08
    
    // Factor 12: Character n-gram similarity for fuzzy matching (0.07)
    let charNgramScore = 0
    const extractCharNgrams = (str: string, n: number): string[] => {
      const ngrams: string[] = []
      for (let i = 0; i <= str.length - n; i++) {
        ngrams.push(str.substr(i, n))
      }
      return ngrams
    }
    const tagTrigrams = extractCharNgrams(tagLower, 3)
    const descTrigrams = extractCharNgrams(descLower, 3)
    let charOverlap = 0
    for (let i = 0; i < tagTrigrams.length; i++) {
      for (let j = 0; j < descTrigrams.length; j++) {
        if (tagTrigrams[i] === descTrigrams[j]) charOverlap++
      }
    }
    if (tagTrigrams.length > 0) {
      const charOverlapRatio = charOverlap / tagTrigrams.length
      charNgramScore += charOverlapRatio * 30
    }
    score += charNgramScore * 0.07
    
    // Factor 13: Phrase detection beyond n-grams (0.05)
    let phraseScore = 0
    const commonPhrases = ['gameplay', 'game play', 'highlights', 'best moments', 'funny moments', 'epic moments', 'clutch moment', 'insane play', 'pro player', 'top player', 'rank up', 'ranked match', 'competitive', 'tournament', 'championship', 'world record', 'speedrun', 'walkthrough', 'gameplay footage', 'lets play', 'letsplay', 'game review', 'game review', 'first look', 'gameplay trailer', 'official trailer', 'gameplay video', 'gaming video', 'content creator', 'streamer', 'live stream', 'livestream', 'reaction video', 'reaction']
    for (let i = 0; i < commonPhrases.length; i++) {
      if (descLower.indexOf(commonPhrases[i]) !== -1 && tagLower.indexOf(commonPhrases[i].replace(' ', '')) !== -1) {
        phraseScore += 15
      } else if (descLower.indexOf(commonPhrases[i]) !== -1 && tagLower.indexOf(commonPhrases[i]) !== -1) {
        phraseScore += 12
      }
    }
    score += phraseScore * 0.05
    
    // Factor 14: Frequency-based weighting (inverse document frequency simulation) (0.05)
    let frequencyScore = 0
    // Penalize very common words, boost rare but relevant words
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that', 'with', 'they', 'from', 'what', 'when', 'there', 'would', 'more', 'about', 'which', 'their', 'will', 'than', 'then', 'them', 'like', 'time', 'just', 'very', 'into', 'your', 'some', 'could', 'such', 'were', 'other', 'each', 'so', 'only', 'also', 'new', 'make', 'first', 'being', 'after', 'should', 'work', 'get', 'most']
    let hasCommonWord = false
    for (let i = 0; i < commonWords.length; i++) {
      if (tagLower === commonWords[i]) {
        hasCommonWord = true
        break
      }
    }
    if (!hasCommonWord && tagLower.length > 3) {
      frequencyScore += 8
    }
    score += frequencyScore * 0.05
    
    // Factor 15: Phonetic similarity for misspelling tolerance (0.06)
    let phoneticScore = 0
    const levenshteinDistance = (s1: string, s2: string): number => {
      const len1 = s1.length
      const len2 = s2.length
      const matrix: number[][] = []
      
      for (let i = 0; i <= len1; i++) {
        matrix[i] = [i]
      }
      for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j
      }
      
      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          )
        }
      }
      
      return matrix[len1][len2]
    }
    
    // Check phonetic similarity with description words
    for (let i = 0; i < descriptionWords.length; i++) {
      const word = descriptionWords[i]
      if (word.length > 3 && tagLower.length > 3) {
        const distance = levenshteinDistance(tagLower, word)
        const maxLen = Math.max(tagLower.length, word.length)
        const similarity = 1 - (distance / maxLen)
        
        // If very similar (80%+), give partial credit
        if (similarity >= 0.8) {
          phoneticScore += 15
        } else if (similarity >= 0.7) {
          phoneticScore += 8
        } else if (similarity >= 0.6) {
          phoneticScore += 4
        }
      }
    }
    score += phoneticScore * 0.06
    
    // Factor 16: Tag co-occurrence analysis (0.07) - boost related tags
    let coOccurrenceScore = 0
    const detectedConcepts = []
    if (detectedGame) detectedConcepts.push(detectedGame)
    if (detectedActivity) detectedConcepts.push(detectedActivity)
    if (detectedSubject) detectedConcepts.push(detectedSubject)
    
    for (let i = 0; i < detectedConcepts.length; i++) {
      const concept = detectedConcepts[i]
      if (coOccurrenceMap[concept]) {
        const relatedTags = coOccurrenceMap[concept]
        for (let j = 0; j < relatedTags.length; j++) {
          if (tagLower.indexOf(relatedTags[j]) !== -1) {
            coOccurrenceScore += 12
          }
        }
      }
    }
    // Also check if current tag is a key in the co-occurrence map
    if (coOccurrenceMap[tagLower]) {
      for (let i = 0; i < detectedConcepts.length; i++) {
        const concept = detectedConcepts[i]
        if (coOccurrenceMap[tagLower].indexOf(concept) !== -1) {
          coOccurrenceScore += 10
        }
      }
    }
    score += coOccurrenceScore * 0.07
    
    // Factor 17: Trending/temporal scoring (0.04) - boost time-sensitive tags
    let trendingScore = 0
    const currentYear = new Date().getFullYear()
    const trendingTerms = [
      '2024', '2025', '2026', 'new', 'latest', 'fresh', 'just dropped', 'just released', 'breaking', 'news',
      'trending', 'viral', 'fyp', 'foryou', 'foryoupage', 'explore', 'discover', 'hot', 'popular',
      'season', 'chapter', 'update', 'patch', 'new season', 'new chapter', 'live now', 'happening now',
      'today', 'this week', 'this month', 'recent', 'current', 'now', 'right now'
    ]
    
    for (let i = 0; i < trendingTerms.length; i++) {
      if (descLower.indexOf(trendingTerms[i]) !== -1 && tagLower.indexOf(trendingTerms[i]) !== -1) {
        trendingScore += 8
      }
    }
    
    // Boost tags with current year if description mentions time-sensitive terms
    if (descLower.indexOf('2024') !== -1 || descLower.indexOf('2025') !== -1 || descLower.indexOf('2026') !== -1) {
      if (tagLower.indexOf(currentYear.toString()) !== -1) {
        trendingScore += 10
      }
    }
    
    // Boost tags that indicate freshness or newness
    if (descLower.indexOf('new') !== -1 || descLower.indexOf('latest') !== -1 || descLower.indexOf('fresh') !== -1) {
      if (tagLower.indexOf('new') !== -1 || tagLower.indexOf('latest') !== -1 || tagLower.indexOf('fresh') !== -1) {
        trendingScore += 12
      }
    }
    
    score += trendingScore * 0.04
    
    // Factor 19: Jaccard similarity coefficient (0.04)
    let jaccardScore = 0
    const tagSet = new Set(tagLower.split(''))
    const descSet = new Set(descLower.split(''))
    const tagArray = Array.from(tagSet)
    const descArray = Array.from(descSet)
    const intersection = new Set(tagArray.filter(x => descSet.has(x)))
    const union = new Set([...tagArray, ...descArray])
    if (union.size > 0) {
      const jaccardIndex = intersection.size / union.size
      jaccardScore += jaccardIndex * 25
    }
    score += jaccardScore * 0.04
    
    // Factor 20: Dice coefficient (0.04)
    let diceScore = 0
    if (tagSet.size + descSet.size > 0) {
      const diceCoefficient = (2 * intersection.size) / (tagSet.size + descSet.size)
      diceScore += diceCoefficient * 25
    }
    score += diceScore * 0.04
    
    // Factor 21: Soundex phonetic algorithm (0.03)
    const soundex = (str: string): string => {
      const codes: Record<string, string> = {
        'b': '1', 'f': '1', 'p': '1', 'v': '1',
        'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
        'd': '3', 't': '3',
        'l': '4',
        'm': '5', 'n': '5',
        'r': '6'
      }
      str = str.toLowerCase().replace(/[^a-z]/g, '')
      if (str.length === 0) return ''
      let result = str[0].toUpperCase()
      for (let i = 1; i < str.length; i++) {
        const char = str[i]
        const code = codes[char]
        if (code && code !== result[result.length - 1]) {
          result += code
        }
      }
      return (result + '000').substring(0, 4)
    }
    
    let soundexScore = 0
    const tagSoundex = soundex(tagLower)
    for (let i = 0; i < descriptionWords.length; i++) {
      const wordSoundex = soundex(descriptionWords[i])
      if (tagSoundex === wordSoundex && tagSoundex.length > 0) {
        soundexScore += 10
      }
    }
    score += soundexScore * 0.03
    
    // Factor 22: TF-IDF weighted word matching (0.05)
    let tfidfScore = 0
    for (let i = 0; i < descriptionWords.length; i++) {
      const word = descriptionWords[i]
      if (tagLower.indexOf(word) !== -1 && wordImportance[word]) {
        tfidfScore += wordImportance[word] * 8
      }
    }
    score += tfidfScore * 0.05
    
    // Factor 23: Word embedding similarity using co-occurrence vectors (0.04)
    let embeddingScore = 0
    for (const word in wordCoOccurrence) {
      if (tagLower.indexOf(word) !== -1) {
        const relatedWords = wordCoOccurrence[word]
        for (let i = 0; i < relatedWords.length; i++) {
          if (descLower.indexOf(relatedWords[i]) !== -1) {
            embeddingScore += 6
          }
        }
      }
    }
    // Also check reverse - description words that relate to tag
    for (let i = 0; i < descriptionWords.length; i++) {
      const word = descriptionWords[i]
      if (wordCoOccurrence[word]) {
        const relatedWords = wordCoOccurrence[word]
        for (let j = 0; j < relatedWords.length; j++) {
          if (tagLower.indexOf(relatedWords[j]) !== -1) {
            embeddingScore += 5
          }
        }
      }
    }
    score += embeddingScore * 0.04
    
    // Factor 24: Tag diversity and category balance (0.03)
    let diversityScore = 0
    // Check if tag represents different categories for balance
    const isGameTag = gameKeys.some(key => tagLower.indexOf(key) !== -1)
    const isActivityTag = Object.keys(activityKeywords).some(key => tagLower.indexOf(key) !== -1)
    const isSubjectTag = Object.keys(subjectKeywords).some(key => tagLower.indexOf(key) !== -1)
    const isSentimentTag = Object.keys(sentimentWords).some(key => tagLower.indexOf(key) !== -1)
    
    // Boost tags that add category diversity
    const categoryCount = (isGameTag ? 1 : 0) + (isActivityTag ? 1 : 0) + (isSubjectTag ? 1 : 0) + (isSentimentTag ? 1 : 0)
    if (categoryCount > 0) {
      diversityScore += categoryCount * 3
    }
    
    // Slight boost for tags that are NOT the primary detected category (encourages diversity)
    if (detectedGame && !isGameTag && (isActivityTag || isSubjectTag)) {
      diversityScore += 5
    }
    if (detectedActivity && !isActivityTag && (isGameTag || isSubjectTag)) {
      diversityScore += 5
    }
    if (detectedSubject && !isSubjectTag && (isGameTag || isActivityTag)) {
      diversityScore += 5
    }
    
    score += diversityScore * 0.03
    
    // Factor 18: Irrelevance penalty (negative scoring) - penalize tags with no context matches
    let hasAnyMatch = false
    let matchCount = 0
    
    // Check if tag matches any description word
    for (let i = 0; i < descriptionWords.length; i++) {
      if (tagLower.indexOf(descriptionWords[i]) !== -1) {
        hasAnyMatch = true
        matchCount++
      }
    }
    
    // Check if tag matches detected context
    if (detectedGame && tagLower.indexOf(detectedGame) !== -1) {
      hasAnyMatch = true
      matchCount += 2
    }
    if (detectedActivity && tagLower.indexOf(detectedActivity) !== -1) {
      hasAnyMatch = true
      matchCount += 2
    }
    if (detectedSubject && tagLower.indexOf(detectedSubject) !== -1) {
      hasAnyMatch = true
      matchCount += 2
    }
    
    // Heavy penalty for tags with no matches at all
    if (!hasAnyMatch) {
      score -= 50
    }
    // Moderate penalty for tags with very few matches
    else if (matchCount < 2) {
      score -= 20
    }
    
    return { tag, score }
  })
  
  // Sort by score descending
  scoredTags.sort((a, b) => b.score - a.score)
  
  // Adaptive minimum score threshold - adjust based on available high-scoring tags
  const highScoringTags = scoredTags.filter(st => st.score >= 5)
  const mediumScoringTags = scoredTags.filter(st => st.score >= 2 && st.score < 5)
  
  // Start with high-scoring tags
  let selectedTags = highScoringTags.slice(0, count).map(st => st.tag)
  
  // If not enough, add medium-scoring tags that have at least some context match
  if (selectedTags.length < count && mediumScoringTags.length > 0) {
    const remaining = count - selectedTags.length
    const mediumTagsWithContext = mediumScoringTags.filter(st => {
      const tagLower = st.tag.toLowerCase()
      // Check if tag has any word match in description
      for (let i = 0; i < descriptionWords.length; i++) {
        if (tagLower.indexOf(descriptionWords[i]) !== -1) return true
      }
      return false
    })
    
    selectedTags = selectedTags.concat(mediumTagsWithContext.slice(0, remaining).map(st => st.tag))
  }
  
  // Final fallback: add tags from detected context only (maintains relevance)
  if (selectedTags.length < count && (detectedGame || detectedActivity || detectedSubject)) {
    const contextRelevantTags = platformTags.filter(tag => {
      const tagLower = tag.toLowerCase()
      const alreadySelected = selectedTags.indexOf(tag) === -1
      
      // Only add if tag relates to detected context
      let contextMatch = false
      if (detectedGame && tagLower.indexOf(detectedGame) !== -1) contextMatch = true
      if (detectedActivity && tagLower.indexOf(detectedActivity) !== -1) contextMatch = true
      if (detectedSubject && tagLower.indexOf(detectedSubject) !== -1) contextMatch = true
      
      return alreadySelected && contextMatch
    })
    
    while (selectedTags.length < count && contextRelevantTags.length > 0) {
      selectedTags.push(contextRelevantTags.shift()!)
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
    } else {
      console.log(`Using full tag database for ${platform}: ${platformTags.length} tags`)
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
