import { NextResponse } from 'next/server'

// Google Cloud Natural Language API integration with enhanced analysis
async function extractEntitiesWithGoogle(description: string): Promise<{ entities: string[], categories: string[], sentiment: string }> {
  const apiKey = process.env.GOOGLE_API_KEY
  
  if (!apiKey) {
    console.log('Google API key not configured, skipping entity extraction')
    return { entities: [], categories: [], sentiment: 'neutral' }
  }
  
  try {
    // Analyze entities
    const entityResponse = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: {
            content: description,
            type: 'PLAIN_TEXT',
          },
          encodingType: 'UTF8',
        }),
      }
    )
    
    // Analyze sentiment
    const sentimentResponse = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: {
            content: description,
            type: 'PLAIN_TEXT',
          },
          encodingType: 'UTF8',
        }),
      }
    )
    
    // Analyze categories
    const classifyResponse = await fetch(
      `https://language.googleapis.com/v1/documents:classifyText?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: {
            content: description,
            type: 'PLAIN_TEXT',
          },
          encodingType: 'UTF8',
        }),
      }
    )
    
    const extractedTerms: string[] = []
    const categories: string[] = []
    let sentiment = 'neutral'
    
    // Process entities
    if (entityResponse.ok) {
      const entityData = await entityResponse.json()
      const entities = entityData.entities || []
      
      for (const entity of entities) {
        if (entity.name) {
          extractedTerms.push(entity.name.toLowerCase())
        }
        
        if (entity.metadata && entity.metadata.wikipedia_url) {
          const wikiMatch = entity.metadata.wikipedia_url.match(/\/wiki\/([^\/]+)$/)
          if (wikiMatch) {
            extractedTerms.push(wikiMatch[1].toLowerCase().replace(/_/g, ' '))
          }
        }
        
        if (entity.mentions && entity.mentions.length > 0) {
          for (const mention of entity.mentions) {
            if (mention.text && mention.text.content) {
              extractedTerms.push(mention.text.content.toLowerCase())
            }
          }
        }
      }
    }
    
    // Process sentiment
    if (sentimentResponse.ok) {
      const sentimentData = await sentimentResponse.json()
      const documentSentiment = sentimentData.documentSentiment
      if (documentSentiment) {
        if (documentSentiment.score > 0.25) sentiment = 'positive'
        else if (documentSentiment.score < -0.25) sentiment = 'negative'
        else sentiment = 'neutral'
      }
    }
    
    // Process categories
    if (classifyResponse.ok) {
      const classifyData = await classifyResponse.json()
      const categoryData = classifyData.categories || []
      
      for (const category of categoryData) {
        if (category.name) {
          categories.push(category.name)
        }
        if (category.categories) {
          for (const subCategory of category.categories) {
            if (subCategory.name) {
              categories.push(subCategory.name)
            }
          }
        }
      }
    }
    
    console.log(`Extracted ${extractedTerms.length} entities, ${categories.length} categories, sentiment: ${sentiment}`)
    return { 
      entities: Array.from(new Set(extractedTerms)), 
      categories: Array.from(new Set(categories)),
      sentiment
    }
  } catch (error) {
    console.error('Error calling Google API:', error)
    return { entities: [], categories: [], sentiment: 'neutral' }
  }
}

// Read algorithm data for platform-specific insights
async function readAlgorithmData(platform: string): Promise<any> {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const algoPath = path.join(process.cwd(), 'algorithm-data.json')
    const algoRaw = await fs.readFile(algoPath, 'utf-8')
    const algoData = JSON.parse(algoRaw)
    return algoData.data?.[platform] || null
  } catch (error) {
    console.error('Could not read algorithm data:', error)
    return null
  }
}

// Extract trending topics and keywords from algorithm data
function extractAlgorithmInsights(algorithmData: any): { trending: string[], tips: string[], forbidden: string[] } {
  const trending: string[] = []
  const tips: string[] = []
  const forbidden: string[] = []
  
  if (!algorithmData) return { trending, tips, forbidden }
  
  if (algorithmData.summaries && Array.isArray(algorithmData.summaries)) {
    for (const summary of algorithmData.summaries) {
      const words = summary.toLowerCase().split(/\s+/)
      trending.push(...words.filter((w: string) => w.length > 3))
    }
  }
  
  if (algorithmData.editingTips) {
    const words = algorithmData.editingTips.toLowerCase().split(/\s+/)
    tips.push(...words.filter((w: string) => w.length > 3))
  }
  
  if (algorithmData.postingTips) {
    const words = algorithmData.postingTips.toLowerCase().split(/\s+/)
    tips.push(...words.filter((w: string) => w.length > 3))
  }
  
  const forbiddenPatterns = ['avoid', 'don\'t', 'never', 'not', 'spam', 'overuse', 'excessive']
  if (algorithmData.descriptionTips) {
    const words = algorithmData.descriptionTips.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      if (forbiddenPatterns.includes(words[i]) && i < words.length - 1) {
        forbidden.push(words[i + 1])
      }
    }
  }
  
  return {
    trending: Array.from(new Set(trending)),
    tips: Array.from(new Set(tips)),
    forbidden: Array.from(new Set(forbidden))
  }
}

// Smart tag matching based on game/platform detection
function detectContentContext(entities: string[], categories: string[]): { game: string | null, activity: string | null, platform: string | null, niche: string[] } {
  const gameKeywords: Record<string, string[]> = {
    'fortnite': ['fortnite', 'victory royale', 'battle royale', 'epic games', 'battle pass'],
    'minecraft': ['minecraft', 'craft', 'mine', 'block', 'mojang', 'creeper', 'redstone'],
    'valorant': ['valorant', 'riot games', 'agent', 'spike', 'radiant', 'immortal'],
    'apex': ['apex legends', 'apex', 'respawn', 'legend', 'wraith', 'octane'],
    'gta': ['gta', 'grand theft auto', 'rockstar', 'los santos', 'heist'],
    'cod': ['call of duty', 'cod', 'warzone', 'modern warfare', 'activision'],
    'league': ['league of legends', 'lol', 'riot', 'summoner', 'rift', 'champion'],
    'roblox': ['roblox', 'obby', 'tycoon', 'blox', 'adopt me'],
    'genshin': ['genshin impact', 'teyvat', 'mihoyo', 'honkai', 'zhongli']
  }
  
  const activityKeywords: Record<string, string[]> = {
    'gaming': ['game', 'play', 'gaming', 'gameplay', 'stream', 'live', 'esports'],
    'creative': ['art', 'draw', 'paint', 'create', 'design', 'edit', 'creative'],
    'music': ['music', 'song', 'audio', 'sound', 'beat', 'remix', 'cover'],
    'cooking': ['cook', 'recipe', 'food', 'bake', 'kitchen', 'chef'],
    'fitness': ['workout', 'fitness', 'gym', 'exercise', 'health', 'training'],
    'travel': ['travel', 'trip', 'vacation', 'destination', 'explore', 'adventure'],
    'comedy': ['funny', 'comedy', 'joke', 'humor', 'laugh', 'meme', 'sketch'],
    'education': ['tutorial', 'learn', 'educational', 'tips', 'how to', 'guide', 'explain']
  }
  
  const platformKeywords: Record<string, string[]> = {
    'twitch': ['twitch', 'stream', 'live stream', 'broadcast'],
    'youtube': ['youtube', 'video', 'content creator', 'channel'],
    'tiktok': ['tiktok', 'fyp', 'viral', 'trend'],
    'instagram': ['instagram', 'reels', 'igtv', 'story'],
    'kick': ['kick', 'kick streaming', 'kick.com']
  }
  
  let detectedGame: string | null = null
  let detectedActivity: string | null = null
  let detectedPlatform: string | null = null
  const detectedNiche: string[] = []
  
  const allText = [...entities, ...categories].join(' ').toLowerCase()
  
  for (const [game, keywords] of Object.entries(gameKeywords)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        detectedGame = game
        break
      }
    }
    if (detectedGame) break
  }
  
  for (const [activity, keywords] of Object.entries(activityKeywords)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        detectedActivity = activity
        break
      }
    }
    if (detectedActivity) break
  }
  
  for (const [platform, keywords] of Object.entries(platformKeywords)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        detectedPlatform = platform
        break
      }
    }
    if (detectedPlatform) break
  }
  
  for (const category of categories) {
    const niche = category.split('/').pop()?.toLowerCase()
    if (niche && niche.length > 3) {
      detectedNiche.push(niche)
    }
  }
  
  return {
    game: detectedGame,
    activity: detectedActivity,
    platform: detectedPlatform,
    niche: detectedNiche
  }
}

// Generate platform-specific popular tags based on context
function generateContextualTags(context: any, platform: string): string[] {
  const tags: string[] = []
  
  if (context.game) {
    const gameTags: Record<string, string[]> = {
      'fortnite': ['fortnite', 'fortniteclips', 'fortnitegameplay', 'epicpartner', 'fortnitetips', 'fortnitehighlights', 'fortnitefunny', 'fortniteskin', 'fortnitebattlepass', 'victoryroyale', 'fortnitetournament', 'fortnitecompetitive', 'fortniteranked', 'fortnitearena', 'fortnitecreative', 'fortnitebuild', 'fortniteedit'],
      'minecraft': ['minecraft', 'minecraftclips', 'minecraftgameplay', 'minecraftmemes', 'minecraftfunny', 'minecraftbuild', 'minecraftbuilding', 'minecraftsurvival', 'minecraftcreative', 'minecraftpvp', 'minecraftserver', 'minecraftrealm', 'minecraftmod', 'minecraftmods', 'minecrafttexture', 'minecraftshader', 'creeper', 'redstone', 'diamond', 'nether', 'enderman'],
      'valorant': ['valorant', 'valorantclips', 'valorantgameplay', 'riotgames', 'valoranttips', 'valoranthighlights', 'valorantfunny', 'valorantskin', 'valorantagent', 'spike', 'radiant', 'immortal', 'valorantcompetitive', 'valorantranked', 'valorantclutch', 'valorantace', 'jett', 'sage', 'reyna'],
      'apex': ['apexlegends', 'apex', 'apexclips', 'apexgameplay', 'respawn', 'apextips', 'apexhighlights', 'apexfunny', 'apexlegend', 'apexcharacter', 'wraith', 'octane', 'pathfinder', 'bloodhound', 'apexcompetitive', 'apexranked', 'apexclutch', 'apexace', 'apexpredator'],
      'gta': ['gta', 'gta5', 'gtaonline', 'gtarp', 'rockstargames', 'gtatips', 'gtahighlights', 'gtafunny', 'gtacar', 'gtamod', 'gtacheats', 'gtaonline', 'lossantos', 'gtaheist', 'gtamission', 'gtamodding', 'gtaroleplay', 'gta6'],
      'cod': ['callofduty', 'cod', 'warzone', 'modernwarfare', 'activision', 'codtips', 'codhighlights', 'codfunny', 'codloadout', 'codgun', 'codcompetitive', 'codranked', 'codclutch', 'codace', 'codwarzone', 'codmultiplayer', 'codzombies'],
      'league': ['leagueoflegends', 'lol', 'riotgames', 'loltips', 'lolhighlights', 'lolfunny', 'lolchampion', 'lolskin', 'lolcompetitive', 'lolranked', 'lolclutch', 'lolace', 'lolpro', 'lolchallenger', 'summonerrift', 'baron', 'dragon', 'nexus'],
      'roblox': ['roblox', 'robloxclips', 'robloxgameplay', 'robloxtips', 'robloxhighlights', 'robloxfunny', 'robloxgame', 'robloxtshirt', 'robloxoutfit', 'robloxcatalog', 'robloxstudio', 'robloxdev', 'robloxbloxy', 'robloxobby', 'robloxtower', 'robloxadventure'],
      'genshin': ['genshinimpact', 'genshin', 'mihoyo', 'genshintips', 'genshinhighlights', 'genshincharacter', 'genshinskin', 'genshinbuild', 'teyvat', 'zhongli', 'raiden', 'venti', 'nahida', 'furina', 'genshinartifact', 'genshinweapon', 'genshinmap']
    }
    
    if (gameTags[context.game]) {
      tags.push(...gameTags[context.game])
    }
  }
  
  // Activity-specific tags
  if (context.activity) {
    const activityTags: Record<string, string[]> = {
      'gaming': ['gaming', 'gamer', 'gameplay', 'gameplayclips', 'gamingcommunity', 'gaminglife', 'gamers', 'esports', 'competitive', 'pro', 'casual', 'hardcore', 'gamingsetup', 'gaminggear', 'gamingchair', 'gamingpc', 'gamingmonitor'],
      'creative': ['art', 'artist', 'digitalart', 'drawing', 'painting', 'illustration', 'design', 'creative', 'artistsoninstagram', 'artcommunity', 'artoftheday', 'artwork', 'artist', 'sketch', 'doodle', 'artdaily', 'artcollective'],
      'music': ['music', 'musician', 'artist', 'song', 'cover', 'remix', 'beat', 'producer', 'musicproducer', 'musician', 'musiclife', 'musiclover', 'musicislife', 'newmusic', 'indiemusic', 'hiphop', 'rap', 'rnb', 'pop', 'rock', 'electronic'],
      'cooking': ['cooking', 'recipe', 'food', 'foodie', 'foodporn', 'chef', 'homecooking', 'cookingtips', 'foodphotography', 'foodstagram', 'yummy', 'delicious', 'homemade', 'foodblogger', 'foodlover', 'tasty', 'foodie', 'instafood'],
      'fitness': ['fitness', 'workout', 'gym', 'exercise', 'health', 'training', 'fitfam', 'fitnessmotivation', 'fitnessjourney', 'gymrat', 'bodybuilding', 'cardio', 'strength', 'hiit', 'yoga', 'pilates', 'crossfit', 'personaltrainer'],
      'travel': ['travel', 'travelgram', 'wanderlust', 'travelphotography', 'travelblogger', 'adventure', 'explore', 'vacation', 'trip', 'destination', 'traveling', 'traveler', 'worldtraveler', 'travelhacks', 'travelguide', 'instatravel'],
      'comedy': ['funny', 'comedy', 'humor', 'laugh', 'jokes', 'memes', 'memedaily', 'memes', 'lol', 'lmao', 'hilarious', 'comedygold', 'standupcomedy', 'funnyvideos', 'viralcomedy', 'sketchcomedy', 'improv'],
      'education': ['tutorial', 'howto', 'tips', 'learn', 'education', 'educational', 'learning', 'knowledge', 'study', 'studygram', 'productivity', 'selfimprovement', 'motivation', 'inspiration', 'growthmindset', 'lifelonglearning']
    }
    
    if (activityTags[context.activity]) {
      tags.push(...activityTags[context.activity])
    }
  }
  
  // Platform-specific tags
  const platformTags: Record<string, string[]> = {
    'tiktok': ['fyp', 'foryou', 'foryoupage', 'viral', 'trending', 'tiktokviral', 'tiktoktrend', 'tiktokfamous', 'tiktokmade', 'tiktokdance', 'tiktokchallenge', 'tiktokcomedy', 'tiktoklife', 'tiktokers', 'tiktokindia', 'tiktokusa', 'tiktokuk'],
    'instagram': ['instagood', 'photooftheday', 'instadaily', 'instamood', 'instalike', 'instafollow', 'instagrammers', 'instacool', 'instafashion', 'instabeauty', 'instatravel', 'instafood', 'instafit', 'instamusic', 'instaart'],
    'youtube-shorts': ['shorts', 'youtubeshorts', 'shortsviral', 'shortsfeed', 'shortscreator', 'shortsvideo', 'shortsfunny', 'shortscomedy', 'shortstrending', 'shortschallenge', 'shortsdance', 'shortsreact', 'shortscreative'],
    'youtube-long': ['youtube', 'youtuber', 'youtubechannel', 'youtubers', 'youtubevideo', 'youtubecreator', 'subscribe', 'like', 'comment', 'youtubelife', 'youtubeoriginals', 'youtubegaming', 'youtubemusic', 'youtubevlog'],
    'facebook-reels': ['facebookreels', 'fbreels', 'facebookvideo', 'facebookwatch', 'facebookgaming', 'facebookcreative', 'facebookfunny', 'facebookviral', 'facebooktrending', 'facebookcontent', 'facebookcreator']
  }
  
  if (platformTags[platform]) {
    tags.push(...platformTags[platform])
  }
  
  return Array.from(new Set(tags))
}

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
      'today', '2026', 'newvideo', 'justposted', 'fresh', 'update',
      'breaking', 'breakingnews', 'news', 'headline', 'flash', 'alert',
      'mustwatch', 'mustsee', 'cantmiss', 'viralclip', 'viralshort',
      'trendalert', 'trendingsound', 'trendingsong', 'trendingmusic',
      'vibes', 'mood', 'aesthetic', 'viralchallenge', 'challenge',
      'challengeaccepted', 'trend', 'trends', 'viralvideo', 'viralpost',
      'viralreel', 'viralshorts', 'viralcontent', 'viralnow', 'goinviral',
      'explorepage', 'fypage', 'foryou', 'foryoupage', 'fypシ', 'fypviral',
      'trendingtopic', 'trendinghashtag', 'trendingtag', 'hottopic',
      'hotcontent', 'viralhit', 'viral sensation', 'sensation', 'buzzy',
      'buzzing', 'buzz', 'hype', 'hyped', 'overhyped', 'underrated',
      'hidden gem', 'hidden gems', 'underratedcontent', 'sleeper',
      'sleeperhit', 'cultclassic', 'classic', 'timeless', 'iconic',
      'legendary', 'epic', 'insane', 'crazy', 'unreal', 'unbelievable',
      'mindblowing', 'mindblown', 'shocking', 'stunning', 'breathtaking',
      'mesmerizing', 'captivating', 'engaging', 'compelling', 'addictive',
      'bingeworthy', 'binge', 'bingewatch', 'mustsee', 'cantlookaway',
      'hooked', 'obsessed', 'addicted', 'cantstopwatching', 'rewatch',
      'rewatchvalue', 'replayvalue', 'watchagain', 'watchloop',
      'looping', 'onrepeat', 'repeat', 'infinityloop', 'endlessloop',
      'satisfying', 'oddlysatisfying', 'asmr', 'relaxing', 'calming',
      'therapeutic', 'soothing', 'peaceful', 'zen', 'mindful',
      'mindfulness', 'meditation', 'stressrelief', 'anxietyrelief',
      'dopamine', 'dopaminehit', 'dopamineboost', 'serotonin',
      'feelgood', 'goodvibes', 'positivevibes', 'positivity', 'optimism',
      'inspiration', 'motivation', 'encouragement', 'uplifting',
      'heartwarming', 'touching', 'emotional', 'emotionalrollercoaster',
      'feels', 'allthefeels', 'emotionaldamage', 'tearjerker', 'sad',
      'happytears', 'cry', 'sobbing', 'laughing', 'lol', 'lmao', 'rofl',
      'dying', 'dead', 'imdead', 'icanntbreathe', 'screaming', 'shook',
      'shooketh', 'shocking', 'surprising', 'unexpected', 'plot twist',
      'plotwist', 'cliffhanger', 'suspense', 'thriller', 'mystery',
      'whodunit', 'detective', 'investigation', 'truecrime', 'crime',
      'documentary', 'docuseries', 'expose', 'revealed', 'exposed',
      'truth', 'facts', 'factcheck', 'verified', 'confirmed', 'debunked',
      'fake', 'fakenews', 'misinformation', 'conspiracy', 'theory',
      'conspiracytheory', 'rabbit hole', 'rabbithole', 'deepdive',
      'deepdive', 'analysis', 'breakdown', 'explained', 'explanation',
      'tutorial', 'guide', 'howto', 'tips', 'tricks', 'hacks', 'lifehack',
      'diy', 'doityourself', 'craft', 'creative', 'creativity', 'art',
      'artist', 'artwork', 'drawing', 'painting', 'sketch', 'digitalart',
      'design', 'graphicdesign', 'editing', 'videoediting', 'edit',
      'edits', 'transition', 'transitions', 'effects', 'vfx', 'sfx',
      'sound', 'audio', 'music', 'song', 'track', 'beat', 'melody',
      'rhythm', 'harmony', 'lyrics', 'cover', 'remix', 'mashup', 'mix',
      'dj', 'producer', 'artist', 'musician', 'singer', 'rapper',
      'band', 'group', 'duo', 'trio', 'quartet', 'ensemble', 'orchestra',
      'classical', 'jazz', 'blues', 'rock', 'pop', 'hiphop', 'rap',
      'country', 'folk', 'electronic', 'edm', 'techno', 'house', 'dubstep',
      'trap', 'lofi', 'chill', 'chillhop', 'relax', 'study', 'focus',
      'workout', 'gym', 'exercise', 'fitness', 'health', 'wellness',
      'nutrition', 'diet', 'food', 'cooking', 'recipe', 'baking',
      'chef', 'homemade', 'delicious', 'yummy', 'tasty', 'foodie',
      'foodporn', 'foodgasm', 'mukbang', 'eat', 'eating', 'feast',
      'fashion', 'style', 'outfit', 'ootd', 'lookbook', 'clothing',
      'apparel', 'wear', 'streetwear', 'luxury', 'designer', 'brand',
      'beauty', 'makeup', 'skincare', 'hair', 'nails', 'cosmetics',
      'tutorial', 'transformation', 'beforeandafter', 'glowup', 'makeover'
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
  
  // Verb-noun pair detection for better context understanding
  const commonVerbs = ['play', 'watch', 'make', 'get', 'go', 'run', 'walk', 'jump', 'eat', 'drink', 'sleep', 'talk', 'laugh', 'cry', 'help', 'love', 'hate', 'know', 'think', 'see', 'hear', 'feel', 'smell', 'taste', 'buy', 'sell', 'build', 'create', 'destroy', 'kill', 'win', 'lose', 'fight', 'attack', 'defend', 'shoot', 'drive', 'fly', 'swim', 'climb', 'fall', 'stand', 'sit', 'lie', 'rise', 'drop', 'catch', 'throw', 'kick', 'punch', 'hit', 'slap', 'push', 'pull', 'drag', 'lift', 'carry', 'hold', 'grab', 'take', 'give', 'receive', 'send', 'bring', 'fetch', 'chase', 'hunt', 'search', 'find', 'discover', 'explore', 'travel', 'visit', 'meet', 'greet', 'welcome', 'thank', 'apologize', 'forgive', 'forget', 'remember', 'learn', 'teach', 'study', 'read', 'write', 'speak', 'listen', 'sing', 'dance', 'draw', 'paint', 'cook', 'clean', 'wash', 'dry', 'fix', 'repair', 'break', 'open', 'close', 'lock', 'unlock', 'start', 'stop', 'begin', 'end', 'finish', 'complete', 'continue', 'pause', 'wait', 'stay', 'leave', 'arrive', 'depart', 'return', 'come', 'enter', 'exit', 'escape', 'survive', 'live', 'die', 'born', 'grow', 'change', 'move', 'transform', 'become', 'remain', 'keep', 'save', 'waste', 'spend', 'earn', 'lose', 'win', 'bet', 'gamble', 'risk', 'dare', 'try', 'attempt', 'succeed', 'fail', 'work', 'rest', 'relax', 'play', 'enjoy', 'like', 'love', 'hate', 'dislike', 'prefer', 'want', 'need', 'wish', 'hope', 'dream', 'imagine', 'believe', 'trust', 'doubt', 'fear', 'worry', 'care', 'mind', 'matter', 'concern', 'interest', 'excite', 'bore', 'tire', 'weary', 'exhaust', 'refresh', 'renew', 'restore', 'recover', 'heal', 'cure', 'treat', 'help', 'serve', 'assist', 'support', 'protect', 'defend', 'guard', 'save', 'rescue', 'free', 'release', 'liberate', 'capture', 'catch', 'arrest', 'stop', 'prevent', 'avoid', 'escape', 'hide', 'seek', 'find', 'lose', 'miss', 'hit', 'strike', 'beat', 'defeat', 'conquer', 'overcome', 'surpass', 'exceed', 'reach', 'achieve', 'accomplish', 'succeed', 'fail', 'try', 'attempt', 'struggle', 'fight', 'battle', 'war', 'peace', 'calm', 'quiet', 'silence', 'noise', 'sound', 'hear', 'listen', 'speak', 'talk', 'say', 'tell', 'ask', 'answer', 'question', 'reply', 'respond', 'shout', 'whisper', 'sing', 'hum', 'whistle', 'clap', 'snap', 'tap', 'knock', 'ring', 'buzz', 'beep', 'click', 'scroll', 'swipe', 'type', 'write', 'draw', 'paint', 'sketch', 'color', 'shade', 'design', 'create', 'make', 'build', 'construct', 'assemble', 'manufacture', 'produce', 'generate', 'develop', 'grow', 'raise', 'breed', 'feed', 'water', 'plant', 'harvest', 'gather', 'collect', 'store', 'keep', 'hold', 'carry', 'transport', 'move', 'shift', 'transfer', 'deliver', 'ship', 'send', 'receive', 'accept', 'reject', 'refuse', 'deny', 'admit', 'confess', 'reveal', 'hide', 'conceal', 'cover', 'expose', 'show', 'display', 'exhibit', 'present', 'demonstrate', 'prove', 'disprove', 'test', 'check', 'verify', 'confirm', 'validate', 'examine', 'inspect', 'analyze', 'study', 'research', 'investigate', 'explore', 'discover', 'invent', 'create', 'design', 'plan', 'organize', 'arrange', 'schedule', 'manage', 'control', 'direct', 'lead', 'guide', 'teach', 'train', 'educate', 'learn', 'study', 'practice', 'improve', 'develop', 'grow', 'progress', 'advance', 'succeed', 'fail', 'try', 'attempt']
  
  const commonNouns = ['game', 'player', 'video', 'content', 'music', 'song', 'sound', 'audio', 'image', 'picture', 'photo', 'camera', 'phone', 'computer', 'laptop', 'screen', 'display', 'keyboard', 'mouse', 'controller', 'console', 'gaming', 'gamer', 'stream', 'streamer', 'live', 'broadcast', 'channel', 'subscriber', 'follower', 'fan', 'viewer', 'audience', 'community', 'social', 'media', 'platform', 'app', 'application', 'software', 'program', 'code', 'data', 'information', 'knowledge', 'skill', 'talent', 'ability', 'power', 'strength', 'speed', 'time', 'moment', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century', 'age', 'era', 'period', 'history', 'future', 'past', 'present', 'life', 'death', 'birth', 'growth', 'change', 'progress', 'success', 'failure', 'victory', 'defeat', 'win', 'loss', 'challenge', 'problem', 'solution', 'answer', 'question', 'mystery', 'secret', 'truth', 'lie', 'fact', 'fiction', 'story', 'tale', 'legend', 'myth', 'fantasy', 'dream', 'reality', 'world', 'universe', 'space', 'earth', 'planet', 'star', 'sun', 'moon', 'sky', 'cloud', 'rain', 'snow', 'wind', 'storm', 'weather', 'nature', 'animal', 'plant', 'tree', 'flower', 'fruit', 'food', 'drink', 'water', 'air', 'fire', 'light', 'dark', 'shadow', 'color', 'shape', 'size', 'form', 'structure', 'building', 'house', 'home', 'room', 'door', 'window', 'wall', 'floor', 'ceiling', 'roof', 'ground', 'street', 'road', 'path', 'way', 'direction', 'place', 'location', 'position', 'spot', 'area', 'region', 'zone', 'territory', 'land', 'country', 'city', 'town', 'village', 'neighborhood', 'community', 'society', 'culture', 'people', 'person', 'human', 'man', 'woman', 'child', 'baby', 'family', 'friend', 'enemy', 'stranger', 'neighbor', 'colleague', 'partner', 'team', 'group', 'crowd', 'audience', 'public', 'government', 'politics', 'law', 'rule', 'regulation', 'policy', 'system', 'method', 'technique', 'strategy', 'plan', 'goal', 'objective', 'purpose', 'reason', 'cause', 'effect', 'result', 'outcome', 'consequence', 'impact', 'influence', 'power', 'authority', 'control', 'freedom', 'rights', 'justice', 'fairness', 'equality', 'peace', 'war', 'conflict', 'violence', 'crime', 'punishment', 'reward', 'prize', 'gift', 'present', 'donation', 'charity', 'help', 'support', 'service', 'business', 'company', 'industry', 'market', 'economy', 'money', 'currency', 'price', 'cost', 'value', 'worth', 'profit', 'loss', 'investment', 'trade', 'exchange', 'sale', 'purchase', 'buy', 'sell', 'product', 'good', 'item', 'object', 'thing', 'stuff', 'material', 'resource', 'tool', 'instrument', 'device', 'machine', 'technology', 'innovation', 'invention', 'discovery', 'science', 'art', 'music', 'literature', 'language', 'word', 'sentence', 'phrase', 'text', 'message', 'communication', 'conversation', 'discussion', 'debate', 'argument', 'opinion', 'view', 'perspective', 'attitude', 'belief', 'faith', 'religion', 'spirit', 'soul', 'mind', 'thought', 'idea', 'concept', 'theory', 'hypothesis', 'philosophy', 'wisdom', 'knowledge', 'education', 'school', 'university', 'college', 'teacher', 'student', 'class', 'lesson', 'subject', 'topic', 'theme', 'issue', 'matter', 'problem', 'solution', 'answer', 'question', 'test', 'exam', 'grade', 'score', 'result', 'achievement', 'accomplishment', 'success', 'failure', 'attempt', 'effort', 'work', 'job', 'career', 'profession', 'occupation', 'vocation', 'calling', 'passion', 'hobby', 'interest', 'activity', 'action', 'event', 'occasion', 'situation', 'circumstance', 'condition', 'state', 'status', 'quality', 'quantity', 'amount', 'number', 'figure', 'statistic', 'data', 'information', 'fact', 'detail', 'aspect', 'feature', 'characteristic', 'property', 'attribute', 'quality', 'trait', 'element', 'component', 'part', 'piece', 'section', 'segment', 'portion', 'share', 'fraction', 'percentage', 'rate', 'ratio', 'proportion', 'scale', 'level', 'degree', 'extent', 'measure', 'standard', 'criterion', 'benchmark', 'reference', 'example', 'instance', 'case', 'sample', 'specimen', 'model', 'pattern', 'design', 'style', 'format', 'structure', 'organization', 'arrangement', 'order', 'sequence', 'series', 'list', 'catalog', 'index', 'directory', 'guide', 'manual', 'instruction', 'direction', 'command', 'order', 'request', 'demand', 'offer', 'proposal', 'suggestion', 'recommendation', 'advice', 'tip', 'hint', 'clue', 'sign', 'signal', 'indication', 'warning', 'alert', 'notice', 'announcement', 'declaration', 'statement', 'report', 'account', 'description', 'explanation', 'definition', 'meaning', 'sense', 'purpose', 'function', 'role', 'duty', 'responsibility', 'obligation', 'task', 'job', 'work', 'assignment', 'project', 'mission', 'quest', 'journey', 'trip', 'travel', 'adventure', 'experience', 'memory', 'story', 'tale', 'legend', 'myth']
  
  // Extract verb-noun pairs from bigrams
  const verbNounPairs: string[] = []
  for (let i = 0; i < descriptionWords.length - 1; i++) {
    const firstWord = descriptionWords[i]
    const secondWord = descriptionWords[i + 1]
    
    // Check if first word is a verb and second is a noun
    if (commonVerbs.includes(firstWord) && commonNouns.includes(secondWord)) {
      verbNounPairs.push(`${firstWord}${secondWord}`)
    }
    // Also check reverse order (noun-verb)
    if (commonNouns.includes(firstWord) && commonVerbs.includes(secondWord)) {
      verbNounPairs.push(`${firstWord}${secondWord}`)
    }
  }
  
  // Co-occurrence patterns for common phrases
  const commonPhrases = [
    // Gaming phrases
    'victoryroyale', 'chickendinner', 'firstblood', 'doublekill', 'triplekill', 'quadkill', 'pentakill',
    'ace', 'clutch', 'teamfight', 'baron', 'dragon', 'nexus', 'inhibitor', 'turret', 'minion', 'creep',
    'jungle', 'mid', 'top', 'bot', 'adc', 'support', 'carry', 'tank', 'healer', 'dps', 'assassin',
    'sniper', 'rifle', 'shotgun', 'smg', 'pistol', 'knife', 'grenade', 'rocket', 'explosive',
    'spawn', 'respawn', 'camp', 'rush', 'push', 'defend', 'attack', 'flank', 'retreat', 'surrender',
    'gg', 'wp', 'glhf', 'ggez', 'noob', 'pro', 'hacker', 'cheater', 'ban', 'kick', 'mute', 'report',
    'rank', 'level', 'xp', 'exp', 'loot', 'drop', 'rare', 'epic', 'legendary', 'mythic', 'exotic',
    'craft', 'build', 'upgrade', 'enhance', 'enchant', 'reforge', 'socket', 'gem', 'stat', 'attribute',
    'skill', 'ability', 'ultimate', 'passive', 'active', 'cooldown', 'mana', 'energy', 'health', 'shield',
    'armor', 'damage', 'crit', 'dodge', 'block', 'parry', 'stun', 'slow', 'root', 'silence', 'disarm',
    // Content phrases
    'viralvideo', 'viralcontent', 'trendingnow', 'mustwatch', 'mustsee', 'cantmiss', 'breakingnews',
    'exclusivecontent', 'behindthescenes', 'bts', 'makingof', 'tutorial', 'howto', 'stepbystep',
    'tipsandtricks', 'lifehack', 'diy', 'doityourself', 'review', 'unboxing', 'haul', 'tryon',
    'transformation', 'beforeandafter', 'glowup', 'makeover', 'challenge', 'challengeaccepted',
    'reaction', 'react', 'duet', 'stitch', 'remix', 'mashup', 'cover', 'parody', 'spoof',
    'compilation', 'bestof', 'top10', 'top5', 'moments', 'highlights', 'fails', 'wins', 'funny',
    'comedy', 'sketch', 'prank', 'social', 'experiment', 'vlog', 'daily', 'routine', 'dayinlife',
    'qanda', 'askme', 'interview', 'storytime', 'confession', 'rant', 'advice', 'motivation',
    'inspiration', 'educational', 'informative', 'entertainment', 'lifestyle', 'travel', 'food',
    'cooking', 'recipe', 'baking', 'fitness', 'workout', 'gym', 'health', 'wellness', 'beauty',
    'fashion', 'style', 'ootd', 'lookbook', 'hauls', 'reviews', 'tech', 'gadgets', 'gaming',
    'music', 'dance', 'art', 'drawing', 'painting', 'craft', 'diy', 'pets', 'animals', 'nature',
    // Emotional phrases
    'feelgood', 'goodvibes', 'positivevibes', 'positivity', 'optimism', 'inspiration', 'motivation',
    'heartwarming', 'touching', 'emotional', 'tearjerker', 'happytears', 'allthefeels', 'emotionaldamage',
    'mindblowing', 'shocking', 'surprising', 'unexpected', 'plotwist', 'cliffhanger', 'suspense',
    'satisfying', 'oddlysatisfying', 'asmr', 'relaxing', 'calming', 'therapeutic', 'soothing',
    'peaceful', 'zen', 'mindful', 'mindfulness', 'meditation', 'stressrelief', 'anxietyrelief',
    // Action phrases
    'gonewild', 'goingviral', 'goinviral', 'trendalert', 'viralhit', 'sensation', 'buzzing',
    'hype', 'hyped', 'breaking', 'breakingnews', 'flash', 'alert', 'urgent', 'emergency',
    'live', 'livestream', 'livevideo', 'premiere', 'exclusive', 'firstlook', 'sneakpeek',
    'trailer', 'teaser', 'preview', 'announcement', 'reveal', 'launch', 'release', 'drop',
    'update', 'new', 'fresh', 'latest', 'justposted', 'justdropped', 'justreleased',
    // Social phrases
    'follow', 'followforfollow', 'like', 'likeforlike', 'comment', 'share', 'subscribe',
    'notifications', 'notification', 'bell', 'ring', 'turnon', 'post', 'story', 'highlight',
    'reel', 'tiktok', 'fyp', 'foryou', 'foryoupage', 'explore', 'explorepage', 'discover',
    'hashtag', 'tag', 'mention', 'dm', 'directmessage', 'inbox', 'chat', 'message',
    'community', 'family', 'fam', 'squad', 'team', 'crew', 'gang', 'bestie', 'bff',
    'friendship', 'relationship', 'couple', 'goals', 'relationshipgoals', 'couplegoals',
    // Gaming specific co-occurrences
    'playgame', 'playgames', 'gamingvideo', 'gamingcontent', 'gameplay', 'letsplay',
    'walkthrough', 'playthrough', 'speedrun', 'speedrun', 'nolife', 'hardcore', 'casual',
    'competitive', 'esports', 'tournament', 'championship', 'match', 'round', 'game',
    'ranked', 'unranked', 'placement', 'promotion', 'demotion', 'season', 'pass',
    'battlepass', 'seasonpass', 'event', 'limitedtime', 'exclusive', 'rare', 'special',
    'cosmetic', 'skin', 'outfit', 'emote', 'celebration', 'finisher', 'execution',
    'weapon', 'gun', 'loadout', 'build', 'meta', 'op', 'broken', 'nerf', 'buff',
    'patch', 'update', 'hotfix', 'maintenance', 'downtime', 'server', 'region',
    'ping', 'lag', 'fps', 'performance', 'graphics', 'settings', 'quality', 'resolution'
  ]
  
  // Check for phrase co-occurrences in the description
  const detectedPhrases: string[] = []
  for (const phrase of commonPhrases) {
    if (descLower.includes(phrase)) {
      detectedPhrases.push(phrase)
    }
  }
  
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
    'fortnite': ['fortnite', 'victory', 'royale', 'battle', 'build', 'building', 'edit', 'editing', 'pump', 'tac', 'scar', 'p90', 'rocket', 'grenade', 'storm', 'circle', 'zone', 'bus', 'island', 'chapter', 'season', 'skin', 'emote', 'dance', 'vbucks', 'epic', 'lobby', 'drop', 'axe', 'rpg', 'ar', 'smg', 'sniper', 'shotgun', 'crank', '90s', 'box', 'boxfight', 'turtling', 'high ground', 'edit course', 'free build', 'creative', 'zero build', 'no build', 'ranked', 'arena', 'cash cup', 'fn', 'sweaty', 'tryhard', 'bot', 'aim assist', 'controller', 'kbm', 'sens', 'sensitivity', 'deadzone', 'bumper jumper', 'builder pro', 'combat pro', 'gyro', 'mobile', 'ios', 'android', 'switch', 'ps4', 'ps5', 'xbox', 'pc', 'crossplay', 'cross platform', 'duo', 'trios', 'squads', 'solo', 'fill', 'no fill', 'custom match', 'private match', 'creative map', 'island code', 'map code', 'featured island', 'og', 'original', 'leak', 'datamine', 'update', 'patch', 'hotfix', 'downtime', 'maintenance', 'event', 'live event', 'concert', 'movie', 'map change', 'vault', 'unvaulted', 'mythic', 'exotic', 'legendary', 'epic', 'rare', 'uncommon', 'common', 'chug jug', 'slurp juice', 'shield potion', 'small shield', 'big shield', 'bandages', 'medkit', 'minis', 'max shield', 'full health', 'full shield', 'knock', 'elimination', 'elim', 'frag', 'kill feed', 'victory royale', 'royale', 'win', 'winner', 'chicken dinner', 'last one standing', 'last alive', 'circle', 'storm', 'safe zone', 'zone', 'map', 'point of interest', 'poi', 'named location', 'titled', 'titled towers', 'pleasant park', 'tilted', 'salty springs', 'tomato town', 'lazy links', 'retail row', 'dusty depot', 'fatal fields', 'anarchy acres', 'greasy grove', 'moisty mire', 'risk reel', 'snobby shores', 'haunted hills', 'lonely lodge', 'vega', 'paradise palms', 'polar peak', 'happy hamlets', 'pleasant park', 'frenzy farm', 'craggy cliffs', 'misty meadows', 'catty corner', 'boney burbs', 'weeping woods', 'slurpy swamp', 'holly hedges', 'steamy stacks', 'agency', 'dirty docks', 'corny complex', 'corrupted', 'corrupted areas', 'zero point', 'the aftermath', 'convergence', 'apollo', 'ragnarok', 'cattus', 'bunker jonesy', 'fortnitemares', 'fortnite item shop', 'fortnite battle pass', 'fortnite chapter', 'fortnite season', 'fortnite update', 'fortnite patch', 'fortnite event', 'fortnite live event', 'fortnite concert', 'fortnite movie', 'fortnite map', 'fortnite creative', 'fortnite save the world', 'stw', 'fortnite mobile', 'fortnite switch', 'fortnite ps4', 'fortnite ps5', 'fortnite xbox', 'fortnite pc', 'fortnite crossplay', 'fortnite controller', 'fortnite kbm', 'fortnite sensitivity', 'fortnite settings', 'fortnite pro', 'fortnite streamer', 'fortnite content creator', 'fortnite youtuber', 'fortnite tiktok', 'fortnite twitch', 'fortnite youtube', 'fortnite highlights', 'fortnite funny moments', 'fortnite epic moments', 'fortnite clutch moments', 'fortnite best plays', 'fortnite montage', 'fortnite edit', 'fortnite build', 'fortnite box fight', 'fortnite 1v1', 'fortnite 2v2', 'fortnite 3v3', 'fortnite 4v4', 'fortnite cash cup', 'fortnite fn', 'fortnite epic games', 'fortnite battle royale', 'fortnite br', 'fortnite creative', 'fortnite c', 'fortnite save the world', 'fortnite stw', 'fortnite mobile', 'fortnite ios', 'fortnite android', 'fortnite switch', 'fortnite nintendo switch', 'fortnite playstation', 'fortnite ps4', 'fortnite ps5', 'fortnite xbox', 'fortnite xbox one', 'fortnite xbox series x', 'fortnite xbox series s', 'fortnite pc', 'fortnite computer', 'fortnite laptop', 'fortnite gaming pc', 'fortnite crossplay', 'fortnite cross platform', 'fortnite controller', 'fortnite controller aim', 'fortnite aim assist', 'fortnite keyboard and mouse', 'fortnite kbm', 'fortnite sensitivity', 'fortnite dpi', 'fortnite edpi', 'fortnite deadzone', 'fortnite bumper jumper', 'fortnite builder pro', 'fortnite combat pro', 'fortnite gyro', 'fortnite mobile controls', 'fortnite touch controls', 'fortnite hud', 'fortnite settings', 'fortnite graphics', 'fortnite performance', 'fortnite fps', 'fortnite lag', 'fortnite ping', 'fortnite server', 'fortnite region', 'fortnite na east', 'fortnite na west', 'fortnite eu', 'fortnite asia', 'fortnite oceania', 'fortnite brazil', 'fortnite middle east'],
    'minecraft': ['minecraft', 'craft', 'mining', 'mine', 'block', 'blocks', 'biome', 'creeper', 'zombie', 'skeleton', 'enderman', 'dragon', 'nether', 'end', 'diamond', 'iron', 'gold', 'redstone', 'building', 'survival', 'creative', 'server', 'realm', 'mod', 'cave', 'spider', 'skeleton', 'steve', 'alex', 'villager', 'creeper', 'spawn', 'respawn', 'death', 'die', 'kill', 'pvp', 'survival games', 'hunger games', 'bed wars', 'sky wars', 'capture the flag', 'ctf', 'spleef', 'parkour', 'creative', 'survival', 'hardcore', 'adventure', 'spectator', 'cheat', 'hack', 'mod', 'texture pack', 'resource pack', 'shader', 'optifine', 'forge', 'fabric', 'quilt', 'spigot', 'bukkit', 'paper', 'purpur', 'velocity', 'bungeecord', 'waterfall', 'limbo', 'velocity', 'server', 'hosting', 'realm', 'realms', 'realm plus', 'realm subscription', 'mojang', 'microsoft', 'xbox game studios', 'java edition', 'bedrock edition', 'pe', 'pocket edition', 'windows 10', 'windows 11', 'nintendo switch', 'ps4', 'ps5', 'xbox one', 'xbox series x', 'xbox series s', 'mobile', 'ios', 'android', 'fire tv', 'linux', 'macos', 'mac', 'crossplay', 'cross platform', 'multiplayer', 'singleplayer', 'offline', 'lan', 'local area network', 'server ip', 'ip address', 'port', 'whitelist', 'blacklist', 'ban', 'kick', 'mute', 'op', 'operator', 'admin', 'moderator', 'mod', 'rank', 'permission', 'plugin', 'datapack', 'command', 'command block', 'redstone', 'comparator', 'repeater', 'piston', 'sticky piston', 'observer', 'hopper', 'dropper', 'dispenser', 'furnace', 'blast furnace', 'smoker', 'brewing stand', 'cauldron', 'enchanting table', 'anvil', 'grindstone', 'smithing table', 'fletching table', 'cartography table', 'loom', 'barrel', 'shulker box', 'ender chest', 'chest', 'ender pearl', 'ender eye', 'blaze rod', 'blaze powder', 'nether star', 'elytra', 'firework rocket', 'firework star', 'beacon', 'conduit', 'turtle helmet', 'trident', 'riptide', 'loyalty', 'impaling', 'channeling', 'mending', 'unbreaking', 'efficiency', 'fortune', 'silk touch', 'sharpness', 'smite', 'bane of arthropods', 'knockback', 'fire aspect', 'looting', 'sweeping edge', 'thorns', 'protection', 'blast protection', 'fire protection', 'projectile protection', 'feather falling', 'depth strider', 'frost walker', 'respiration', 'aqua affinity', 'thorns', 'unbreaking', 'mending', 'curse of vanishing', 'curse of binding', 'soul speed', 'swift sneak', 'experience', 'xp', 'exp', 'level', 'enchanting', 'enchantment', 'brewing', 'potion', 'splash potion', 'lingering potion', 'tipped arrow', 'golden apple', 'enchanted golden apple', 'golden carrot', 'glistering melon', 'spider eye', 'fermented spider eye', 'magma cream', 'blaze powder', 'ghast tear', 'rabbit foot', 'pufferfish', 'turtle shell', 'phantom membrane', 'dragon breath', 'gunpowder', 'sugar', 'redstone', 'glowstone dust', 'nether quartz', 'nether wart', 'glowstone', 'sea lantern', 'prismarine', 'prismarine crystals', 'prismarine shard', 'nautilus shell', 'heart of the sea', 'scute', 'turtle scute', 'rabbit hide', 'rabbit foot', 'iron ingot', 'gold ingot', 'diamond', 'emerald', 'netherite ingot', 'netherite scrap', 'ancient debris', 'gold nugget', 'iron nugget', 'copper ingot', 'raw copper', 'raw iron', 'raw gold', 'amethyst shard', 'copper block', 'raw copper block', 'lightning rod', 'spyglass', 'bundle', 'candle', 'soul campfire', 'soul lantern', 'soul torch', 'soul soil', 'soul sand', 'basalt', 'blackstone', 'gilded blackstone', 'polished blackstone', 'chiseled polished blackstone', 'cracked polished blackstone', 'bricks', 'nether bricks', 'cracked nether bricks', 'chiseled nether bricks', 'quartz bricks', 'quartz pillar', 'chiseled quartz block', 'quartz block', 'smooth quartz', 'purpur block', 'purpur pillar', 'chiseled purpur', 'end stone', 'end brick', 'obsidian', 'crying obsidian', 'bedrock', 'sandstone', 'red sandstone', 'chiseled sandstone', 'cut sandstone', 'smooth sandstone', 'stone', 'cobblestone', 'mossy cobblestone', 'stone bricks', 'mossy stone bricks', 'cracked stone bricks', 'chiseled stone bricks', 'granite', 'polished granite', 'diorite', 'polished diorite', 'andesite', 'polished andesite', 'deepslate', 'cobbled deepslate', 'polished deepslate', 'deepslate bricks', 'cracked deepslate bricks', 'chiseled deepslate', 'tuff', 'calcite', 'amethyst', 'copper ore', 'deepslate copper ore', 'iron ore', 'deepslate iron ore', 'gold ore', 'deepslate gold ore', 'coal ore', 'deepslate coal ore', 'diamond ore', 'deepslate diamond ore', 'emerald ore', 'deepslate emerald ore', 'lapis lazuli ore', 'deepslate lapis lazuli ore', 'redstone ore', 'deepslate redstone ore', 'ancient debris', 'nether gold ore', 'nether quartz ore', 'glowstone', 'soul sand', 'soul soil', 'gravel', 'sand', 'red sand', 'clay', 'dirt', 'grass block', 'mycelium', 'podzol', 'coarse dirt', 'farmland', 'grass path', 'dirt path', 'moss block', 'moss carpet', 'rooted dirt', 'mud', 'packed mud', 'clay', 'snow', 'snow block', 'powder snow', 'ice', 'packed ice', 'blue ice', 'water', 'lava', 'fire', 'campfire', 'soul campfire', 'torch', 'soul torch', 'lantern', 'soul lantern', 'shroomlight', 'end rod', 'glow lichen', 'sea pickle', 'kelp', 'seagrass', 'bamboo', 'sugar cane', 'cactus', 'vines', 'twisting vines', 'weeping vines', 'lily pad', 'melon stem', 'melon', 'pumpkin stem', 'pumpkin', 'carrots', 'potatoes', 'beetroots', 'wheat', 'cocoa beans', 'sweet berries', 'glow berries', 'chorus flower', 'chorus plant', 'chorus fruit', 'crimson fungus', 'warped fungus', 'crimson nylium', 'warped nylium', 'crimson stem', 'warped stem', 'crimson hyphae', 'warped hyphae', 'nether sprouts', 'crimson roots', 'warped roots', 'fungus', 'mushroom', 'brown mushroom', 'red mushroom', 'huge mushroom', 'mushroom block', 'mushroom stem', 'sponge', 'wet sponge', 'prismarine', 'sea lantern', 'conduit', 'turtle egg', 'turtle', 'cod', 'salmon', 'pufferfish', 'tropical fish', 'dolphin', 'squid', 'glow squid', 'axolotl', 'goat', 'fox', 'bee', 'bee nest', 'beehive', 'panda', 'cat', 'ocelot', 'wolf', 'parrot', 'llama', 'trader llama', 'horse', 'donkey', 'mule', 'skeleton horse', 'zombie horse', 'pig', 'hoglin', 'zoglin', 'strider', 'zombified piglin', 'piglin', 'piglin brute', 'villager', 'zombie villager', 'wandering trader', 'iron golem', 'snow golem', 'golem', 'shulker', 'ender dragon', 'wither', 'elder guardian', 'guardian', 'wither skeleton', 'stray', 'husk', 'drowned', 'cave spider', 'spider', 'silverfish', 'endermite', 'phantom', 'blaze', 'magma cube', 'ghast', 'zombified piglin', 'piglin', 'hoglin', 'zoglin', 'strider', 'vindicator', 'evoker', 'vex', 'pillager', 'ravager', 'illusioner', 'witch', 'creeper', 'skeleton', 'stray', 'wither skeleton', 'spider', 'cave spider', 'zombie', 'husk', 'drowned', 'zombie villager', 'enderman', 'silverfish', 'endermite', 'slime', 'magma cube', 'ghast', 'blaze', 'zombified piglin', 'piglin', 'piglin brute', 'hoglin', 'zoglin', 'strider', 'warden', 'allay', 'frog', 'tadpole', 'warden', 'sculk', 'sculk sensor', 'sculk shrieker', 'sculk catalyst', 'sculk vein', 'deep dark', 'ancient city'],
    'cod': ['cod', 'call', 'duty', 'warzone', 'modern', 'warfare', 'black', 'ops', 'cold', 'war', 'vanguard', 'loadout', 'killstreak', 'nuke', 'camo', 'grind', 'meta', 'sniper', 'quickscope', 'headshot', 'gulag', 'verdansk', 'rebirth', 'dmz', 'plunder', 'resurgence', 'br', 'battle royale', 'dmz', 'extraction', 'ai', 'enemies', 'stronghold', 'black site', 'data center', 'radiation zone', 'armory', 'chemist', 'defend', 'package', 'intel', 'safecracker', 'most wanted', 'cargo', 'train', 'rescue', 'hostage', 'assassination', 'secure', 'data', 'biolab', 'observation tower', 'radar array', 'sam site', 'anti aircraft', 'juggernaut', 'armored transport', 'helicopter', 'chopper', 'vehicle', 'car', 'truck', 'suv', 'atv', 'boat', 'ship', 'plane', 'aircraft', 'helicopter', 'chopper', 'weapon', 'gun', 'rifle', 'smg', 'lmg', 'sniper', 'shotgun', 'pistol', 'launcher', 'melee', 'knife', 'attachment', 'optic', 'sight', 'scope', 'muzzle', 'barrel', 'stock', 'underbarrel', 'magazine', 'ammo', 'perk', 'field upgrade', 'killstreak', 'scorestreak', 'uav', 'counter uav', 'advanced uav', 'precision airstrike', 'cluster strike', 'cruise missile', 'wheelson', 'chopper gunner', 'infantry vehicle', 'cargo truck', 'airstrike', 'bombardment', 'emergency airdrop', 'care package', 'juggernaut', 'special ops', 'specialist', 'operator', 'skin', 'operator skin', 'blueprint', 'weapon blueprint', 'calling card', 'emblem', 'charm', 'sticker', 'finisher', 'execution', 'emote', 'spray', 'voice line', 'quipping', 'battle pass', 'tier', 'level', 'xp', 'experience', 'rank', 'prestige', 'season', 'battle pass', 'cod points', 'cp', 'credits', 'store', 'bundle', 'operator bundle', 'weapon bundle', 'blueprint bundle', 'shop', 'in game store', 'cosmetic', 'microtransaction', 'mtx', 'loot box', 'supply drop', 'resupply box', 'ammo box', 'armor plate', 'plate', 'health', 'stim', 'gas mask', 'field upgrade', 'tactical', 'lethal', 'frag', 'grenade', 'semtex', 'c4', 'claymore', 'proximity mine', 'thermite', 'throwing knife', 'smoke', 'gas', 'flash', 'stun', 'emp', 'snapshot grenade', 'heartbeat sensor', 'camera', 'spy cam', 'trophy system', 'decoy grenade', 'hacking device', 'recon drone', 'portable radar', 'acoustic sensor', 'trip mine', 'proximity alarm', 'motion sensor', 'vehicle perk', 'engineer', 'warzone', 'verdansk', 'rebirth island', 'caldera', 'al mazrah', 'vondel', 'building 21', 'koschei complex', 'dmz', 'extraction zone', 'green zone', 'red zone', 'radiation', 'circle', 'collapse', 'gas', 'storm', 'safe zone', 'buy station', 'resupply', 'loadout drop', 'squad', 'trios', 'duos', 'solo', 'fill', 'no fill', 'custom match', 'private match', 'ranked play', 'skill based matchmaking', 'sbmm', 'kd', 'kill death ratio', 'win loss ratio', 'wlr', 'score per minute', 'spm', 'damage per match', 'dpm', 'headshot percentage', 'accuracy', 'time to kill', 'ttk', 'damage range', 'damage profile', 'recoil', 'recoil pattern', 'spread', 'ads speed', 'sprint to fire', 'reload speed', 'magazine size', 'ammo capacity', 'fire rate', 'rpm', 'mobility', 'handling', 'range', 'effective range', 'damage falloff', 'bullet velocity', 'penetration', 'attachment', 'optic', 'sight', 'scope', 'reflex sight', 'holo sight', 'thermal scope', 'acog', 'sniper scope', 'variable zoom', 'muzzle', 'muzzle brake', 'compensator', 'silencer', 'suppressor', 'flash hider', 'monolithic suppressor', 'laser', 'laser sight', 'underbarrel', 'foregrip', 'angled foregrip', 'vertical foregrip', 'laser sight combo', 'stock', 'stock adapter', 'magazine', 'extended mag', 'fast mag', 'drum mag', 'dual wield', 'akimbo', 'gunsmith', 'custom build', 'meta', 'loadout', 'setup', 'config', 'class', 'build', 'warzone meta', 'warzone loadout', 'warzone setup', 'warzone class', 'warzone build', 'best loadout warzone', 'best gun warzone', 'best ar warzone', 'best smg warzone', 'best sniper warzone', 'best shotgun warzone', 'best lmg warzone', 'best pistol warzone', 'best perk warzone', 'best lethal warzone', 'best tactical warzone', 'best field upgrade warzone', 'warzone camo', 'warzone mastery', 'warzone challenges', 'warzone battle pass', 'warzone season', 'warzone event', 'warzone update', 'warzone patch', 'warzone nerf', 'warzone buff', 'warzone bug', 'warzone glitch', 'warzone exploit', 'warzone hack', 'warzone cheat', 'warzone aimbot', 'warzone wallhack', 'warzone esp', 'warzone triggerbot', 'warzone anti cheat', 'warzone vac', 'warzone ban', 'warzone hwid ban', 'warzone ip ban', 'warzone account ban', 'warzone shadow ban', 'warzone permanent ban', 'warzone temporary ban', 'warzone suspension', 'warzone warning', 'warzone strike', 'warzone appeal', 'warzone ticket', 'warzone support', 'warzone customer service', 'warzone help', 'warzone faq', 'warzone documentation', 'warzone wiki', 'warzone guide', 'warzone tutorial', 'warzone how to', 'warzone tips', 'warzone tricks', 'warzone strategies', 'warzone tactics', 'warzone pro player', 'warzone streamer', 'warzone content creator', 'warzone esports', 'warzone competitive', 'warzone tournament', 'warzone competition', 'warzone contest', 'warzone match', 'warzone game', 'warzone round', 'warzone set', 'warzone best of', 'warzone bo1', 'warzone bo3', 'warzone bo5', 'warzone bo7', 'warzone grand final', 'warzone championship', 'warzone world championship', 'warzone regional', 'warzone major', 'warzone minor', 'warzone qualifier', 'warzone open', 'warzone closed', 'warzone invitational', 'warzone lan', 'warzone offline', 'warzone online', 'warzone studio', 'warzone arena', 'warzone venue', 'warzone stage', 'warzone platform', 'warzone stream', 'warzone broadcast', 'warzone production', 'warzone quality', 'warzone viewer count', 'warzone concurrent', 'warzone peak', 'warzone average', 'warzone live', 'warzone vod', 'warzone highlight', 'warzone clip', 'warzone moment', 'warzone play'],
    'valorant': ['valorant', 'agent', 'jett', 'sage', 'omen', 'brimstone', 'phoenix', 'raze', 'reyna', 'viper', 'cypher', 'sova', 'breach', 'killjoy', 'skye', 'yoru', 'astra', 'kayo', 'chamber', 'neon', 'fade', 'harbor', 'gekko', 'deadlock', 'iso', 'clove', 'vyse', 'tejo', 'waylay', 'ace', 'clutch', 'eco', 'buy', 'round', 'spike', 'plant', 'defuse', 'site', 'rank', 'radiant', 'immortal', 'ascendant', 'diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron', 'act', 'episode', 'ranked', 'competitive', 'unrated', 'deathmatch', 'spike rush', 'escalation', 'replication', 'custom game', 'premier', 'tournament', 'mode', 'map', 'haven', 'bind', 'split', 'ascent', 'icebox', 'breeze', 'fracture', 'lotus', 'pearl', 'sunset', 'abyss', 'site', 'a site', 'b site', 'c site', 'mid', 'heaven', 'hell', 'long', 'short', 'connector', 'garden', 'hookah', 'b main', 'a main', 'b long', 'a long', 'default', 'peek', 'jiggle', 'strafe', 'crouch', 'jump peek', 'wide peek', 'tight peek', 'shoulder peek', 'spam', 'spamming', 'wallbang', 'wall bang', 'one way', 'one-way', 'one way smoke', 'one-way smoke', 'smoke', 'molotov', 'flash', 'stun', 'arrow', 'ability', 'ult', 'ultimate', 'signature', 'basic', 'economy', 'econ', 'full buy', 'force buy', 'eco round', 'save round', 'pistol round', 'bonus round', 'buy round', 'force', 'eco', 'save', 'pistol', 'bonus', 'kill', 'death', 'assist', 'trade', 'trade kill', 'trade death', 'opening kill', 'opening frag', 'first blood', 'ace', 'team ace', 'clutch', '1v1', '1v2', '1v3', '1v4', '1v5', 'solo clutch', 'team clutch', 'defuse', 'plant', 'spike', 'defuse kit', 'ultimate', 'ult', 'orb', 'ultimate orb', 'ability orb', 'signature orb', 'points', 'ult points', 'ability points', 'rank', 'ranked rating', 'rr', 'mmr', 'matchmaking rating', 'act rank', 'peak rank', 'current rank', 'immortal', 'radiant', 'top 500', 'leaderboard', 'ranked', 'competitive', 'premier', 'tournament mode', 'custom game', 'deathmatch', 'spike rush', 'escalation', 'replication', 'swiftplay', 'team deathmatch', 'tdm', 'free for all', 'ffa', 'practice range', 'range', 'shooting range', 'aim lab', 'aim trainer', 'crosshair', 'crosshair profile', 'mouse sensitivity', 'dpi', 'edpi', 'e dpi', 'resolution', 'aspect ratio', 'fov', 'field of view', 'graphics', 'settings', 'performance', 'fps', 'frames per second', 'input lag', 'ping', 'latency', 'packet loss', 'rubberbanding', 'desync', 'lag', 'server', 'region', 'na', 'north america', 'eu', 'europe', 'ap', 'asia pacific', 'kr', 'korea', 'latam', 'latin america', 'br', 'brazil', 'val', 'valorant', 'riot games', 'riot', 'dev', 'developer', 'patch', 'update', 'hotfix', 'maintenance', 'downtime', 'server status', 'agent', 'duelist', 'initiator', 'controller', 'sentinel', 'role', 'duelist', 'initiator', 'controller', 'sentinel', 'jett', 'reyna', 'yoru', 'neon', 'iso', 'raze', 'fade', 'sova', 'breach', 'skye', 'gekko', 'kayo', 'tejo', 'omen', 'viper', 'astra', 'harbor', 'brimstone', 'sage', 'killjoy', 'cypher', 'deadlock', 'chamber', 'vyse', 'clove', 'weapon', 'gun', 'rifle', 'smg', 'shotgun', 'sniper', 'pistol', 'melee', 'knife', 'vandal', 'phantom', 'spectre', 'bulldog', 'guardian', 'marshal', 'operator', 'odin', 'ares', 'judge', 'bucky', 'stinger', 'spectre', 'classic', 'shorty', 'frenzy', 'ghost', 'sheriff', 'marshal', 'operator', 'odin', 'ares', 'judge', 'bucky', 'stinger', 'spectre', 'classic', 'shorty', 'frenzy', 'ghost', 'sheriff', 'melee', 'knife', 'skin', 'weapon skin', 'premium skin', 'deluxe skin', 'ultra skin', 'exclusive skin', 'edition skin', 'variant skin', 'upgrade skin', 'skin upgrade', 'skin level', 'skin buddy', 'skin chroma', 'skin animation', 'skin finisher', 'skin vfx', 'skin sound', 'kill banner', 'agent skin', 'card', 'player card', 'title', 'spray', 'buddy', 'gun buddy', 'radianite', 'rad', 'points', 'vp', 'valorant points', 'currency', 'store', 'item shop', 'daily shop', 'night market', 'bundle', 'skin bundle', 'act bundle', 'episode bundle', 'battle pass', 'act pass', 'episode pass', 'premium', 'free', 'xp', 'experience', 'tier', 'level', 'account', 'smurf', 'smurfing', 'boost', 'boosting', 'carry', 'carry service', 'coach', 'coaching', 'lesson', 'tutorial', 'guide', 'tips', 'tricks', 'strategies', 'tactics', 'meta', 'current meta', 'op', 'overpowered', 'up', 'underpowered', 'balanced', 'broken', 'bugged', 'glitched', 'exploited', 'nerf', 'buff', 'balance', 'balanced', 'unbalanced', 'fair', 'unfair', 'fun', 'enjoyable', 'boring', 'repetitive', 'grindy', 'challenging', 'difficult', 'easy', 'casual', 'hardcore', 'intense', 'relaxing', 'stressful', 'exciting', 'thrilling', 'epic', 'amazing', 'awesome', 'terrible', 'awful', 'good', 'bad', 'great', 'poor', 'excellent', 'horrible', 'fantastic', 'disappointing', 'satisfying', 'frustrating', 'rewarding', 'punishing', 'fair', 'unfair', 'balanced', 'broken', 'skill based', 'rng', 'random', 'luck', 'skill', 'mechanic', 'mechanics', 'feature', 'content', 'dlc', 'expansion', 'update', 'patch', 'season', 'event', 'limited time', 'exclusive', 'rare', 'legendary', 'epic', 'common', 'uncommon', 'mythic', 'exotic', 'unique', 'special', 'cosmetic', 'skin', 'outfit', 'costume', 'emote', 'dance', 'celebration', 'spray', 'banner', 'icon', 'avatar', 'profile', 'customization', 'personalization', 'monetization', 'monetise', 'free to play', 'ftp', 'pay to win', 'ptw', 'pay to skip', 'pts', 'microtransactions', 'mtx', 'loot boxes', 'gacha', 'random drops', 'rng', 'random number generator', 'luck', 'chance', 'probability', 'odds', 'rate', 'drop rate', 'spawn rate', 'rarity', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'exotic', 'unique', 'special', 'limited', 'exclusive', 'seasonal', 'event', 'holiday', 'christmas', 'halloween', 'easter', 'thanksgiving', 'new year', 'valentine', 'summer', 'winter', 'spring', 'fall', 'autumn'],
    'gta': ['gta', 'grand', 'theft', 'auto', 'gta5', 'gta6', 'gtaonline', 'gtarp', 'los', 'santos', 'vice', 'city', 'heist', 'mission', 'franklin', 'michael', 'trevor', 'lamar', 'online', 'roleplay', 'mod', 'gta online', 'gta v', 'gta 5', 'grand theft auto v', 'grand theft auto 5', 'grand theft auto online', 'gtao', 'rockstar games', 'rockstar', 'rdr2', 'red dead redemption 2', 'max payne', 'la noire', 'bully', 'manhunt', 'midnight club', 'table tennis', 'gta 6', 'gta vi', 'grand theft auto vi', 'vice city', 'miami', 'florida', 'leonida', 'lucia', 'jason', 'gta 6 leaks', 'gta vi leaks', 'gta 6 rumors', 'gta vi rumors', 'gta 6 trailer', 'gta vi trailer', 'gta 6 release date', 'gta vi release date', 'gta 6 map', 'gta vi map', 'gta 6 characters', 'gta vi characters', 'gta 6 gameplay', 'gta vi gameplay', 'gta 6 features', 'gta vi features', 'gta 6 graphics', 'gta vi graphics', 'gta 6 engine', 'gta vi engine', 'rage engine', 'rage 9', 'gta 6 online', 'gta vi online', 'gta 6 multiplayer', 'gta vi multiplayer', 'gta 6 story mode', 'gta vi story mode', 'gta 6 single player', 'gta vi single player', 'gta 6 dlc', 'gta vi dlc', 'gta 6 expansion', 'gta vi expansion', 'gta 6 season pass', 'gta vi season pass', 'gta 6 battle pass', 'gta vi battle pass', 'gta 6 microtransactions', 'gta vi microtransactions', 'gta 6 shark cards', 'gta vi shark cards', 'gta 6 gta money', 'gta vi gta money', 'gta 6 cash', 'gta vi cash', 'gta 6 in game currency', 'gta vi in game currency', 'gta 6 economy', 'gta vi economy', 'gta 6 trading', 'gta vi trading', 'gta 6 market', 'gta vi market', 'gta 6 player base', 'gta vi player base', 'gta 6 community', 'gta vi community', 'gta 6 modding', 'gta vi modding', 'gta 6 mods', 'gta vi mods', 'gta 6 script hook', 'gta vi script hook', 'gta 6 openiv', 'gta vi openiv', 'gta 6 menyoo', 'gta vi menyoo', 'gta 6 simple trainer', 'gta vi simple trainer', 'gta 6 native trainer', 'gta vi native trainer', 'gta 6 enhanced native trainer', 'gta vi enhanced native trainer', 'gta 6 lspdfr', 'gta vi lspdfr', 'gta 6 rage plugin hook', 'gta vi rage plugin hook', 'gta 6 scripthookv', 'gta vi scripthookv', 'gta 6 asi loader', 'gta vi asi loader', 'gta 6 asi plugins', 'gta vi asi plugins', 'gta 6 custom scripts', 'gta vi custom scripts', 'gta 6 custom vehicles', 'gta vi custom vehicles', 'gta 6 custom maps', 'gta vi custom maps', 'gta 6 custom missions', 'gta vi custom missions', 'gta 6 custom heists', 'gta vi custom heists', 'gta 6 custom game modes', 'gta vi custom game modes', 'gta 6 roleplay servers', 'gta vi roleplay servers', 'gta 6 rp servers', 'gta vi rp servers', 'gta 6 rp', 'gta vi rp', 'gta 6 roleplay', 'gta vi roleplay', 'gta 6 gtarp', 'gta vi gtarp', 'gta 6 nopixel', 'gta vi nopixel', 'gta 6 eclipse', 'gta vi eclipse', 'gta 6 legacy', 'gta vi legacy', 'gta 6 mafia', 'gta vi mafia', 'gta 6 olympus', 'gta vi olympus', 'gta 6 doj', 'gta vi doj', 'gta 6 badlands', 'gta vi badlands', 'gta 6 los santos roleplay', 'gta vi los santos roleplay', 'gta 6 lucid city', 'gta vi lucid city', 'gta 6 state of liberty', 'gta vi state of liberty', 'gta 6 freedom', 'gta vi freedom', 'gta 6 reality', 'gta vi reality', 'gta 6 vanilla', 'gta vi vanilla', 'gta 6 public', 'gta vi public', 'gta 6 private', 'gta vi private', 'gta 6 whitelisted', 'gta vi whitelisted', 'gta 6 application', 'gta vi application', 'gta 6 interview', 'gta vi interview', 'gta 6 whitelist', 'gta vi whitelist', 'gta 6 character', 'gta vi character', 'gta 6 char', 'gta vi char', 'gta 6 char creation', 'gta vi char creation', 'gta 6 character creation', 'gta vi character creation', 'gta 6 backstory', 'gta vi backstory', 'gta 6 lore', 'gta vi lore', 'gta 6 rp story', 'gta vi rp story', 'gta 6 rp scenario', 'gta vi rp scenario', 'gta 6 rp event', 'gta vi rp event', 'gta 6 rp drama', 'gta vi rp drama', 'gta 6 rp funny moments', 'gta vi rp funny moments', 'gta 6 rp highlights', 'gta vi rp highlights', 'gta 6 rp clips', 'gta vi rp clips', 'gta 6 rp stream', 'gta vi rp stream', 'gta 6 rp twitch', 'gta vi rp twitch', 'gta 6 rp youtube', 'gta vi rp youtube', 'gta 6 rp tiktok', 'gta vi rp tiktok', 'gta 6 rp content creator', 'gta vi rp content creator', 'gta 6 rp streamer', 'gta vi rp streamer', 'gta 6 rp youtuber', 'gta vi rp youtuber', 'gta 6 rp tiktok', 'gta vi rp tiktok', 'gta 6 rp influencer', 'gta vi rp influencer', 'gta 6 rp famous', 'gta vi rp famous', 'gta 6 rp viral', 'gta vi rp viral', 'gta 6 rp trending', 'gta vi rp trending', 'gta 6 rp popular', 'gta vi rp popular', 'gta 6 rp best', 'gta vi rp best', 'gta 6 rp top', 'gta vi rp top', 'gta 6 rp worst', 'gta vi rp worst', 'gta 6 rp toxic', 'gta vi rp toxic', 'gta 6 rp drama', 'gta vi rp drama', 'gta 6 rp beef', 'gta vi rp beef', 'gta 6 rp feud', 'gta vi rp feud', 'gta 6 rp war', 'gta vi rp war', 'gta 6 rp battle', 'gta vi rp battle', 'gta 6 rp fight', 'gta vi rp fight', 'gta 6 rp conflict', 'gta vi rp conflict', 'gta 6 rp controversy', 'gta vi rp controversy', 'gta 6 rp scandal', 'gta vi rp scandal', 'gta 6 rp ban', 'gta vi rp ban', 'gta 6 rp kick', 'gta vi rp kick', 'gta 6 rp warn', 'gta vi rp warn', 'gta 6 rp strike', 'gta vi rp strike', 'gta 6 rp punishment', 'gta vi rp punishment', 'gta 6 rp penalty', 'gta vi rp penalty', 'gta 6 rp consequence', 'gta vi rp consequence', 'gta 6 rp rule', 'gta vi rp rule', 'gta 6 rp rules', 'gta vi rp rules', 'gta 6 rp regulation', 'gta vi rp regulation', 'gta 6 rp policy', 'gta vi rp policy', 'gta 6 rp guideline', 'gta vi rp guideline', 'gta 6 rp standard', 'gta vi rp standard', 'gta 6 rp expectation', 'gta vi rp expectation', 'gta 6 rp requirement', 'gta vi rp requirement', 'gta 6 rp criteria', 'gta vi rp criteria', 'gta 6 rp qualification', 'gta vi rp qualification', 'gta 6 rp condition', 'gta vi rp condition', 'gta 6 rp term', 'gta vi rp term', 'gta 6 rp agreement', 'gta vi rp agreement', 'gta 6 rp contract', 'gta vi rp contract', 'gta 6 rp deal', 'gta vi rp deal', 'gta 6 rp arrangement', 'gta vi rp arrangement', 'gta 6 rp understanding', 'gta vi rp understanding', 'gta 6 rp promise', 'gta vi rp promise', 'gta 6 rp commitment', 'gta vi rp commitment', 'gta 6 rp obligation', 'gta vi rp obligation', 'gta 6 rp duty', 'gta vi rp duty', 'gta 6 rp responsibility', 'gta vi rp responsibility', 'gta 6 rp accountability', 'gta vi rp accountability', 'gta 6 rp liability', 'gta vi rp liability', 'gta 6 rp ownership', 'gta vi rp ownership', 'gta 6 rp possession', 'gta vi rp possession', 'gta 6 rp entitlement', 'gta vi rp entitlement', 'gta 6 rp privilege', 'gta vi rp privilege', 'gta 6 rp right', 'gta vi rp right', 'gta 6 rp freedom', 'gta vi rp freedom', 'gta 6 rp liberty', 'gta vi rp liberty', 'gta 6 rp independence', 'gta vi rp independence', 'gta 6 rp autonomy', 'gta vi rp autonomy', 'gta 6 rp sovereignty', 'gta vi rp sovereignty', 'gta 6 rp self-determination', 'gta vi rp self-determination', 'gta 6 rp choice', 'gta vi rp choice', 'gta 6 rp decision', 'gta vi rp decision', 'gta 6 rp option', 'gta vi rp option', 'gta 6 rp alternative', 'gta vi rp alternative', 'gta 6 rp possibility', 'gta vi rp possibility', 'gta 6 rp opportunity', 'gta vi rp opportunity', 'gta 6 rp chance', 'gta vi rp chance', 'gta 6 rp prospect', 'gta vi rp prospect', 'gta 6 rp potential', 'gta vi rp potential', 'gta 6 rp capacity', 'gta vi rp capacity', 'gta 6 rp capability', 'gta vi rp capability', 'gta 6 rp ability', 'gta vi rp ability', 'gta 6 rp skill', 'gta vi rp skill', 'gta 6 rp talent', 'gta vi rp talent', 'gta 6 rp aptitude', 'gta vi rp aptitude', 'gta 6 rp competence', 'gta vi rp competence', 'gta 6 rp proficiency', 'gta vi rp proficiency', 'gta 6 rp expertise', 'gta vi rp expertise', 'gta 6 rp mastery', 'gta vi rp mastery', 'gta 6 rp knowledge', 'gta vi rp knowledge', 'gta 6 rp understanding', 'gta vi rp understanding', 'gta 6 rp comprehension', 'gta vi rp comprehension', 'gta 6 rp insight', 'gta vi rp insight', 'gta 6 rp wisdom', 'gta vi rp wisdom', 'gta 6 rp intelligence', 'gta vi rp intelligence', 'gta 6 rp intellect', 'gta vi rp intellect', 'gta 6 rp mind', 'gta vi rp mind', 'gta 6 rp brain', 'gta vi rp brain', 'gta 6 rp thought', 'gta vi rp thought', 'gta 6 rp thinking', 'gta vi rp thinking', 'gta 6 rp reasoning', 'gta vi rp reasoning', 'gta 6 rp logic', 'gta vi rp logic', 'gta 6 rp rationality', 'gta vi rp rationality', 'gta 6 rp judgment', 'gta vi rp judgment', 'gta 6 rp discernment', 'gta vi rp discernment', 'gta 6 rp perception', 'gta vi rp perception', 'gta 6 rp awareness', 'gta vi rp awareness', 'gta 6 rp consciousness', 'gta vi rp consciousness', 'gta 6 rp mindfulness', 'gta vi rp mindfulness', 'gta 6 rp attention', 'gta vi rp attention', 'gta 6 rp focus', 'gta vi rp focus', 'gta 6 rp concentration', 'gta vi rp concentration', 'gta 6 rp dedication', 'gta vi rp dedication', 'gta 6 rp commitment', 'gta vi rp commitment', 'gta 6 rp devotion', 'gta vi rp devotion', 'gta 6 rp loyalty', 'gta vi rp loyalty', 'gta 6 rp fidelity', 'gta vi rp fidelity', 'gta 6 rp allegiance', 'gta vi rp allegiance', 'gta 6 rp faithfulness', 'gta vi rp faithfulness', 'gta 6 rp trust', 'gta vi rp trust', 'gta 6 rp confidence', 'gta vi rp confidence', 'gta 6 rp reliance', 'gta vi rp reliance', 'gta 6 rp dependence', 'gta vi rp dependence', 'gta 6 rp independence', 'gta vi rp independence', 'gta 6 rp self-reliance', 'gta vi rp self-reliance', 'gta 6 rp autonomy', 'gta vi rp autonomy', 'gta 6 rp self-sufficiency', 'gta vi rp self-sufficiency', 'gta 6 rp resourcefulness', 'gta vi rp resourcefulness', 'gta 6 rp ingenuity', 'gta vi rp ingenuity', 'gta 6 rp creativity', 'gta vi rp creativity', 'gta 6 rp innovation', 'gta vi rp innovation', 'gta 6 rp inventiveness', 'gta vi rp inventiveness', 'gta 6 rp originality', 'gta vi rp originality', 'gta 6 rp uniqueness', 'gta vi rp uniqueness', 'gta 6 rp individuality', 'gta vi rp individuality', 'gta 6 rp personality', 'gta vi rp personality', 'gta 6 rp character', 'gta vi rp character', 'gta 6 rp identity', 'gta vi rp identity', 'gta 6 rp self', 'gta vi rp self', 'gta 6 rp ego', 'gta vi rp ego', 'gta 6 rp pride', 'gta vi rp pride', 'gta 6 rp dignity', 'gta vi rp dignity', 'gta 6 rp self-respect', 'gta vi rp self-respect', 'gta 6 rp self-esteem', 'gta vi rp self-esteem', 'gta 6 rp self-worth', 'gta vi rp self-worth', 'gta 6 rp self-confidence', 'gta vi rp self-confidence', 'gta 6 rp self-assurance', 'gta vi rp self-assurance', 'gta 6 rp self-belief', 'gta vi rp self-belief', 'gta 6 rp self-trust', 'gta vi rp self-trust', 'gta 6 rp self-acceptance', 'gta vi rp self-acceptance', 'gta 6 rp self-love', 'gta vi rp self-love', 'gta 6 rp self-care', 'gta vi rp self-care', 'gta 6 rp self-improvement', 'gta vi rp self-improvement', 'gta 6 rp self-development', 'gta vi rp self-development', 'gta 6 rp self-growth', 'gta vi rp self-growth', 'gta 6 rp self-actualization', 'gta vi rp self-actualization', 'gta 6 rp self-realization', 'gta vi rp self-realization', 'gta 6 rp self-fulfillment', 'gta vi rp self-fulfillment', 'gta 6 rp happiness', 'gta vi rp happiness', 'gta 6 rp joy', 'gta vi rp joy', 'gta 6 rp bliss', 'gta vi rp bliss', 'gta 6 rp ecstasy', 'gta vi rp ecstasy', 'gta 6 rp euphoria', 'gta vi rp euphoria', 'gta 6 rp elation', 'gta vi rp elation', 'gta 6 rp delight', 'gta vi rp delight', 'gta 6 rp pleasure', 'gta vi rp pleasure', 'gta 6 rp satisfaction', 'gta vi rp satisfaction', 'gta 6 rp contentment', 'gta vi rp contentment', 'gta 6 rp fulfillment', 'gta vi rp fulfillment', 'gta 6 rp gratification', 'gta vi rp gratification', 'gta 6 rp enjoyment', 'gta vi rp enjoyment', 'gta 6 rp amusement', 'gta vi rp amusement', 'gta 6 rp entertainment', 'gta vi rp entertainment', 'gta 6 rp fun', 'gta vi rp fun', 'gta 6 rp excitement', 'gta vi rp excitement', 'gta 6 rp thrill', 'gta vi rp thrill', 'gta 6 rp adventure', 'gta vi rp adventure', 'gta 6 rp exploration', 'gta vi rp exploration', 'gta 6 rp discovery', 'gta vi rp discovery', 'gta 6 rp learning', 'gta vi rp learning', 'gta 6 rp growth', 'gta vi rp growth', 'gta 6 rp progress', 'gta vi rp progress', 'gta 6 rp achievement', 'gta vi rp achievement', 'gta 6 rp success', 'gta vi rp success', 'gta 6 rp victory', 'gta vi rp victory', 'gta 6 rp triumph', 'gta vi rp triumph', 'gta 6 rp accomplishment', 'gta vi rp accomplishment', 'gta 6 rp attainment', 'gta vi rp attainment', 'gta 6 rp realization', 'gta vi rp realization', 'gta 6 rp fulfillment', 'gta vi rp fulfillment', 'gta 6 rp completion', 'gta vi rp completion', 'gta 6 rp conclusion', 'gta vi rp conclusion', 'gta 6 rp finale', 'gta vi rp finale', 'gta 6 rp ending', 'gta vi rp ending', 'gta 6 rp closure', 'gta vi rp closure', 'gta 6 rp resolution', 'gta vi rp resolution', 'gta 6 rp solution', 'gta vi rp solution', 'gta 6 rp answer', 'gta vi rp answer', 'gta 6 rp result', 'gta vi rp result', 'gta 6 rp outcome', 'gta vi rp outcome', 'gta 6 rp consequence', 'gta vi rp consequence', 'gta 6 rp effect', 'gta vi rp effect', 'gta 6 rp impact', 'gta vi rp impact', 'gta 6 rp influence', 'gta vi rp influence', 'gta 6 rp impression', 'gta vi rp impression', 'gta 6 rp mark', 'gta vi rp mark', 'gta 6 rp legacy', 'gta vi rp legacy', 'gta 6 rp heritage', 'gta vi rp heritage', 'gta 6 rp tradition', 'gta vi rp tradition', 'gta 6 rp culture', 'gta vi rp culture', 'gta 6 rp society', 'gta vi rp society', 'gta 6 rp community', 'gta vi rp community', 'gta 6 rp world', 'gta vi rp world', 'gta 6 rp universe', 'gta vi rp universe', 'gta 6 rp reality', 'gta vi rp reality', 'gta 6 rp existence', 'gta vi rp existence', 'gta 6 rp life', 'gta vi rp life', 'gta 6 rp living', 'gta vi rp living', 'gta 6 rp being', 'gta vi rp being', 'gta 6 rp essence', 'gta vi rp essence', 'gta 6 rp spirit', 'gta vi rp spirit', 'gta 6 rp soul', 'gta vi rp soul', 'gta 6 rp heart', 'gta vi rp heart', 'gta 6 rp mind', 'gta vi rp mind', 'gta 6 rp body', 'gta vi rp body', 'gta 6 rp self', 'gta vi rp self'],
    'apex': ['apex', 'apexlegends', 'wraith', 'octane', 'pathfinder', 'bloodhound', 'gibraltar', 'lifeline', 'caustic', 'mirage', 'bangalore', 'revenant', 'crypto', 'wattson', 'horizon', 'fuse', 'valkyrie', 'seer', 'ash', 'mad', 'maggie', 'catalyst', 'conduit', 'newcastle', 'vantage', 'crypto', 'loba', 'rampart', 'legend', 'legends', 'character', 'characters', 'hero', 'heroes', 'ability', 'abilities', 'tactical', 'ultimate', 'passive', 'skill', 'skills', 'kit', 'loadout', 'weapon', 'weapons', 'gun', 'guns', 'rifle', 'smg', 'shotgun', 'sniper', 'pistol', 'melee', 'attachment', 'attachments', 'optic', 'sight', 'scope', 'barrel', 'stock', 'magazine', 'ammo', 'hop-up', 'hopup', 'backpack', 'armor', 'helmet', 'shield', 'health', 'healing', 'shield battery', 'shield cell', 'medkit', 'syringe', 'Phoenix kit', 'ultimate accelerant', 'legend token', 'crafting', 'craft', 'replicator', 'crafting station', 'purple', 'blue', 'gold', 'red', 'care package', 'airdrop', 'supply drop', 'hot zone', 'zone', 'circle', 'ring', 'damage', 'closing', 'safe zone', 'map', 'kings canyon', 'worlds edge', 'olympus', 'storm point', 'eclipse', 'broken moon', 'destiny', 'fragment', 'fragment east', 'fragment west', 'point of interest', 'poi', 'named location', 'skull town', 'fragment', 'capital city', 'estates', 'the gauntlet', 'the tree', 'the pit', 'drill site', 'lava fissure', 'overlook', 'relay', 'the estates', 'the fragment', 'the dome', 'energy depot', 'gravity cannon', 'phase runner', 'survey beacon', 'jump tower', 'zip line', 'gravity cannon', 'trident', 'vehicle', 'vehicles', 'gryphon', 'mozambique', 'hovercar', 'speeder', 'champion', 'champion squad', 'kill leader', 'kill feed', 'elimination', 'elim', 'frag', 'damage', 'assist', 'revive', 'respawn', 'banner', 'death box', 'loot', 'looting', 'legend selection', 'ping', 'pinging', 'mark', 'marking', 'communication', 'voice chat', 'text chat', 'emote', 'emotes', 'quipping', 'finisher', 'execution', 'skin', 'legend skin', 'weapon skin', 'character skin', 'event', 'limited time mode', 'ltm', 'control', 'team deathmatch', 'tdm', 'flashpoint', 'control', 'lockdown', 'ranked', 'league', 'predator', 'master', 'diamond', 'platinum', 'gold', 'silver', 'bronze', 'rp', 'rank points', 'apex coins', 'ac', 'crafting metals', 'legend tokens', 'store', 'shop', 'item shop', 'event store', 'collection event', 'themed event', 'battle pass', 'season', 'split', 'pre-season', 'season 1', 'season 2', 'season 3', 'season 4', 'season 5', 'season 6', 'season 7', 'season 8', 'season 9', 'season 10', 'season 11', 'season 12', 'season 13', 'season 14', 'season 15', 'season 16', 'season 17', 'season 18', 'season 19', 'season 20', 'legacy', 'legacy season', 'chaos theory', 'collection', 'aftermarket', 'escape', 'mergers', 'assassins', 'genesis', 'revelations', 'legacy', 'chaos', 'collection', 'aftermarket', 'escape', 'mergers', 'assassins', 'genesis', 'revelations', 'apex legends mobile', 'apex mobile', 'apex legends mobile', 'apex mobile', 'ea', 'electronic arts', 'respawn', 'respawn entertainment', 'pro', 'professional', 'esports', 'competitive', 'tournament', 'competition', 'contest', 'match', 'game', 'round', 'set', 'best of', 'bo1', 'bo3', 'bo5', 'bo7', 'grand final', 'championship', 'world championship', 'algs', 'apex legends global series', 'pro league', 'apex pro league', 'apl', 'na', 'north america', 'eu', 'europe', 'apac', 'asia pacific', 'kr', 'korea', 'latam', 'latin america', 'br', 'brazil', 'sea', 'southeast asia', 'oceania', 'oce', 'team', 'squad', 'organization', 'org', 'sponsor', 'partner', 'investor', 'owner', 'manager', 'coach', 'analyst', 'caster', 'commentator', 'host', 'interview', 'press', 'conference', 'media', 'coverage', 'stream', 'broadcast', 'production', 'quality', 'viewer', 'count', 'concurrent', 'peak', 'average', 'live', 'vod', 'highlight', 'clip', 'moment', 'play', 'replay', 'save', 'share', 'upload', 'download', 'social', 'media', 'twitter', 'x', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitch', 'kick', 'discord', 'reddit', 'community', 'forum', 'wiki', 'guide', 'database', 'tracker', 'stats', 'profile', 'rank', 'leaderboard', 'season', 'reward', 'title', 'rank', 'flair', 'badge', 'trophy', 'achievement', 'milestone', 'challenge', 'quest', 'mission', 'objective', 'goal', 'target', 'completion', 'progress', 'grind', 'farm', 'boost', 'smurf', 'smurfing', 'derank', 'throw', 'int', 'inting', 'grief', 'griefing', 'troll', 'trolling', 'toxic', 'toxicity', 'bm', 'bad', 'manners', 'gg', 'good', 'game', 'glhf', 'good', 'luck', 'have', 'fun', 'ns', 'nice', 'shot', 'nt', 'nice', 'try', 'wp', 'well', 'played', 'gc', 'ggez', 'ez', 'clap', 'git', 'gud', 'noob', 'rookie', 'beginner', 'amateur', 'casual', 'hardcore', 'competitive', 'esports', 'pro', 'semi', 'pro', 'amateur', 'tier', '3', 'tier', '2', 'tier', '1', 'algs', 'regionals', 'majors', 'worlds', 'championship', 'winner', 'champion', 'mvp', 'finals', 'semifinals', 'quarterfinals', 'bracket', 'group', 'stage', 'knockout', 'elimination', 'playoffs', 'regular', 'season', 'postseason', 'offseason', 'transfer', 'trade', 'roster', 'team', 'org', 'organization', 'sponsor', 'partner', 'investor', 'owner', 'manager', 'coach', 'analyst', 'caster', 'commentator', 'host', 'interview', 'press', 'conference', 'media', 'coverage', 'stream', 'broadcast', 'production', 'quality', 'viewer', 'count', 'concurrent', 'peak', 'average', 'live', 'vod', 'highlight', 'clip', 'moment', 'play'],
    'league': ['league', 'lol', 'leagueoflegends', 'teemo', 'yasuo', 'zed', 'ahri', 'garen', 'darius', 'thresh', 'blitzcrank', 'jinx', 'lux', 'zed', 'master', 'yi', 'jungle', 'mid', 'top', 'adc', 'support', 'rank', 'challenger', 'diamond', 'gold', 'silver', 'bronze', 'iron', 'summoner', 'rift', 'nexus', 'inhibitor', 'tower', 'turret', 'minion', 'creep', 'champion', 'champs', 'skin', 'skins', 'riot', 'games', 'patch', 'update', 'hotfix', 'maintenance', 'downtime', 'server', 'region', 'na', 'eu', 'euw', 'eune', 'kr', 'cn', 'lan', 'las', 'oce', 'ru', 'tr', 'jp', 'sea', 'ping', 'lag', 'fps', 'performance', 'graphics', 'settings', 'quality', 'low', 'medium', 'high', 'ultra', 'audio', 'sound', 'music', 'sfx', 'volume', 'voice', 'chat', 'mute', 'solo', 'push', 'talk', 'ptt', 'sensitivity', 'headphones', 'speakers', 'microphone', 'mic', 'headset', 'audio', 'device', 'driver', 'software', 'firmware', 'connection', 'network', 'internet', 'wifi', 'ethernet', 'lan', 'vpn', 'proxy', 'firewall', 'router', 'modem', 'isp', 'bandwidth', 'speed', 'latency', 'jitter', 'packet', 'loss', 'rubberbanding', 'desync', 'spike', 'drop', 'disconnect', 'timeout', 'error', 'crash', 'bug', 'glitch', 'exploit', 'hack', 'cheat', 'mod', 'script', 'macro', 'aimbot', 'wallhack', 'esp', 'triggerbot', 'recoil', 'spread', 'anti', 'cheat', 'ban', 'hwid', 'ip', 'account', 'permanent', 'temporary', 'suspension', 'warning', 'strike', 'appeal', 'ticket', 'support', 'help', 'faq', 'documentation', 'wiki', 'guide', 'tutorial', 'tips', 'tricks', 'strategies', 'tactics', 'meta', 'current', 'op', 'overpowered', 'up', 'underpowered', 'balanced', 'broken', 'bugged', 'glitched', 'exploited', 'nerf', 'buff', 'patch', 'notes', 'changes', 'new', 'content', 'dlc', 'expansion', 'season', 'pass', 'battle', 'event', 'limited', 'time', 'exclusive', 'rare', 'legendary', 'epic', 'mythic', 'exotic', 'unique', 'special', 'collectible', 'cosmetic', 'skin', 'outfit', 'costume', 'emote', 'celebration', 'pattern', 'color', 'nameplate', 'title', 'badge', 'trophy', 'achievement', 'milestone', 'challenge', 'quest', 'mission', 'objective', 'goal', 'target', 'completion', 'progress', 'grind', 'farm', 'boost', 'carry', 'service', 'coaching', 'lesson', 'tutorial', 'guide', 'mentoring', 'mentor', 'student', 'teacher', 'instructor', 'coach', 'analyst', 'strategist', 'pro', 'player', 'semi', 'amateur', 'casual', 'hardcore', 'competitive', 'esports', 'tournament', 'competition', 'contest', 'match', 'game', 'round', 'set', 'best', 'bo1', 'bo3', 'bo5', 'grand', 'final', 'championship', 'world', 'regional', 'major', 'minor', 'qualifier', 'open', 'closed', 'invitational', 'lan', 'offline', 'online', 'studio', 'arena', 'venue', 'stage', 'platform', 'stream', 'broadcast', 'production', 'quality', 'viewer', 'count', 'concurrent', 'peak', 'average', 'live', 'vod', 'highlight', 'clip', 'moment', 'play', 'replay', 'save', 'share', 'upload', 'download', 'social', 'media', 'twitter', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitch', 'kick', 'discord', 'reddit', 'community', 'forum', 'wiki', 'guide', 'database', 'tracker', 'stats', 'profile', 'rank', 'leaderboard', 'season', 'reward', 'title', 'flair', 'badge', 'trophy'],
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
    const commonPhrases = ['gameplay', 'game play', 'highlights', 'best moments', 'funny moments', 'epic moments', 'clutch moment', 'insane play', 'pro player', 'top player', 'rank up', 'ranked match', 'competitive', 'tournament', 'championship', 'world record', 'speedrun', 'walkthrough', 'gameplay footage', 'lets play', 'letsplay', 'game review', 'game review', 'first look', 'gameplay trailer', 'official trailer', 'gameplay video', 'gaming video', 'content creator', 'streamer', 'live stream', 'livestream', 'reaction video', 'reaction', 'tutorial', 'how to', 'guide', 'tips', 'tricks', 'strategies', 'meta', 'build', 'loadout', 'setup', 'config', 'settings', 'sensitivity', 'crosshair', 'aim', 'aiming', 'accuracy', 'headshot', 'killstreak', 'multikill', 'triple kill', 'quad kill', 'penta kill', 'ace', 'clutch', '1v1', '1v2', '1v3', '1v4', '1v5', 'solo carry', 'team carry', 'carry', 'support', 'tank', 'healer', 'dps', 'damage', 'healing', 'utility', 'flank', 'rush', 'bait', 'camp', 'spawn', 'respawn', 'spawn trap', 'camping', 'camper', 'spawn kill', 'team kill', 'friendly fire', 'ff', 'toxic', 'toxicity', 'bm', 'bad manners', 'gg', 'good game', 'glhf', 'good luck have fun', 'ggez', 'ez', 'noob', 'rookie', 'beginner', 'amateur', 'pro', 'professional', 'esports', 'competitive', 'casual', 'quick play', 'quickplay', 'qp', 'ranked', 'competitive', 'placement', 'placement match', 'placement matches', 'season', 'season pass', 'battle pass', 'premium', 'free', 'ftp', 'premium', 'p2p', 'microtransaction', 'mtx', 'loot box', 'crate', 'key', 'trade', 'market', 'economy', 'currency', 'coins', 'gems', 'gold', 'silver', 'credits', 'bounty', 'contract', 'mission', 'quest', 'objective', 'goal', 'target', 'achievement', 'trophy', 'medal', 'badge', 'rank', 'level', 'xp', 'experience', 'grind', 'farming', 'boost', 'carry service', 'smurf', 'smurfing', 'derank', 'throw', 'inting', 'griefing', 'trolling', 'hack', 'cheat', 'exploit', 'bug', 'glitch', 'patch', 'update', 'hotfix', 'maintenance', 'downtime', 'server', 'region', 'ping', 'latency', 'lag', 'fps', 'performance', 'graphics', 'settings', 'optimization', 'guide', 'tutorial', 'tips', 'tricks', 'strategies', 'tactics', 'meta', 'current meta', 'op', 'overpowered', 'broken', 'nerf', 'buff', 'balance', 'balanced', 'unbalanced', 'fair', 'unfair', 'fun', 'enjoyable', 'boring', 'repetitive', 'grindy', 'challenging', 'difficult', 'easy', 'casual', 'hardcore', 'intense', 'relaxing', 'stressful', 'exciting', 'thrilling', 'epic', 'amazing', 'awesome', 'terrible', 'awful', 'good', 'bad', 'great', 'poor', 'excellent', 'horrible', 'fantastic', 'disappointing', 'satisfying', 'frustrating', 'rewarding', 'punishing', 'fair', 'unfair', 'balanced', 'broken', 'skill based', 'rng', 'random', 'luck', 'skill', 'mechanic', 'mechanics', 'feature', 'content', 'dlc', 'expansion', 'update', 'patch', 'season', 'event', 'limited time', 'exclusive', 'rare', 'legendary', 'epic', 'common', 'uncommon', 'mythic', 'exotic', 'unique', 'special', 'cosmetic', 'skin', 'outfit', 'costume', 'emote', 'dance', 'celebration', 'spray', 'banner', 'icon', 'avatar', 'profile', 'customization', 'personalization', 'monetization', 'monetise', 'free to play', 'ftp', 'pay to win', 'ptw', 'pay to skip', 'pts', 'microtransactions', 'mtx', 'loot boxes', 'gacha', 'random drops', 'rng', 'random number generator', 'luck', 'chance', 'probability', 'odds', 'rate', 'drop rate', 'spawn rate', 'rarity', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'exotic', 'unique', 'special', 'limited', 'exclusive', 'seasonal', 'event', 'holiday', 'christmas', 'halloween', 'easter', 'thanksgiving', 'new year', 'valentine', 'summer', 'winter', 'spring', 'fall', 'autumn']
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
    
    // Reduced penalty for tags with no matches at all (was -50, now -10)
    if (!hasAnyMatch) {
      score -= 10
    }
    // Reduced penalty for tags with very few matches (was -20, now -5)
    else if (matchCount < 2) {
      score -= 5
    }
    
    return { tag, score }
  })
  
  // Sort by score descending
  scoredTags.sort((a, b) => b.score - a.score)
  
  // Adaptive minimum score threshold - very lenient to ensure multiple tags
  const highScoringTags = scoredTags.filter(st => st.score >= 2)
  const mediumScoringTags = scoredTags.filter(st => st.score >= 0 && st.score < 2)
  
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
  
  // If still not enough, add any remaining tags with positive scores
  if (selectedTags.length < count) {
    const remaining = count - selectedTags.length
    const anyPositiveTags = scoredTags.filter(st => st.score > 0 && selectedTags.indexOf(st.tag) === -1)
    selectedTags = selectedTags.concat(anyPositiveTags.slice(0, remaining).map(st => st.tag))
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
    const { description, platform, count = 10, premium = false } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    // Extract entities using Google API for better understanding
    const googleData = await extractEntitiesWithGoogle(description)
    const googleEntities = googleData.entities
    const googleCategories = googleData.categories
    const googleSentiment = googleData.sentiment
    
    // Read algorithm data for platform-specific insights
    const algoData = await readAlgorithmData(platform)
    const algorithmInsights = extractAlgorithmInsights(algoData)
    
    // Detect content context (game, activity, platform, niche)
    const contentContext = detectContentContext(googleEntities, googleCategories)
    console.log('Detected content context:', contentContext)
    
    // Generate contextual tags based on detected context
    const contextualTags = generateContextualTags(contentContext, platform)
    console.log(`Generated ${contextualTags.length} contextual tags`)
    
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
    
    // Generate tags using local algorithm (no API calls)
    const generatedTags = generateTagsFromDescription(description, platformTags, platform, Math.min(count, 50))
    
    // Combine contextual tags with generated tags
    const allTags = [...contextualTags, ...generatedTags]
    const uniqueTags = Array.from(new Set(allTags))
    
    // If Google API extracted entities, boost those tags in the results
    if (googleEntities.length > 0) {
      console.log(`Boosting ${googleEntities.length} Google-extracted entities in tag selection`)
      
      // Create a map of entity to boost score
      const entityBoostMap: Record<string, number> = {}
      for (const entity of googleEntities) {
        entityBoostMap[entity] = 15 // Significant boost for Google-extracted entities
      }
      
      // Also boost algorithm trending topics
      for (const trending of algorithmInsights.trending) {
        entityBoostMap[trending] = 10 // Boost for trending topics
      }
      
      // Re-score tags with Google entity boost
      const scoredTags = uniqueTags.map(tag => {
        const tagLower = tag.toLowerCase()
        let boostScore = 0
        
        // Check if tag matches any Google entity
        for (const entity of googleEntities) {
          if (tagLower.includes(entity) || entity.includes(tagLower)) {
            boostScore += entityBoostMap[entity] || 15
          }
        }
        
        // Check if tag matches trending topics
        for (const trending of algorithmInsights.trending) {
          if (tagLower.includes(trending) || trending.includes(tagLower)) {
            boostScore += entityBoostMap[trending] || 10
          }
        }
        
        // Boost contextual tags (game/activity specific)
        for (const contextualTag of contextualTags) {
          if (tagLower === contextualTag.toLowerCase()) {
            boostScore += 20 // High boost for contextual tags
          }
        }
        
        return { tag, boostScore }
      })
      
      // Sort by boost score (highest first)
      scoredTags.sort((a, b) => b.boostScore - a.boostScore)
      
      // Reorder tags based on boost
      const boostedTags = scoredTags.map(st => st.tag)
      
      return NextResponse.json({
        tags: boostedTags.slice(0, count),
        platform,
        count: boostedTags.slice(0, count).length,
        googleEntities,
        googleCategories,
        googleSentiment,
        contentContext,
        algorithmInsights,
        contextualTagsCount: contextualTags.length,
        generatedAt: new Date().toISOString()
      })
    }
    
    // Fallback without Google API - still use contextual tags
    const finalTags = [...contextualTags, ...generatedTags]
    const finalUniqueTags = Array.from(new Set(finalTags))
    
    return NextResponse.json({
      tags: finalUniqueTags.slice(0, count),
      platform,
      count: finalUniqueTags.slice(0, count).length,
      contentContext,
      algorithmInsights,
      contextualTagsCount: contextualTags.length,
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
