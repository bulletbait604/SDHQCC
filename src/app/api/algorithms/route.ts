import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import clientPromise from '@/lib/mongodb'
import {
  ALGORITHM_DOC_ID,
  ALGORITHM_SNAPSHOT_COLLECTION,
  readAlgorithmSnapshotFromMongo,
  type AlgorithmSnapshotPayload,
} from '@/lib/algorithmSnapshotRead'
import {
  extractBalancedJsonObject,
  normalizeAlgorithmPlatformData,
} from '@/lib/algorithmPlatformNormalize'
import { writeActivityLogEntry } from '@/lib/activityLogWrite'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser } from '@/lib/auth/staffAccess'
import {
  INTERNAL_API_SECRET_HEADER,
  isValidInternalApiSecret,
} from '@/lib/internalApi'

export const dynamic = 'force-dynamic'

/**
 * Text-only monthly research — use Flash-Lite (cheap) by default.
 * Override with ALGORITHM_GEMINI_MODEL if needed.
 * Paid approx: ~$0.10/1M in, ~$0.40/1M out (vs Flash $0.30 / $2.50).
 */
const ALGORITHM_GEMINI_MODEL = (
  process.env.ALGORITHM_GEMINI_MODEL ||
  process.env.GEMINI_ALGORITHM_MODEL ||
  'gemini-2.5-flash-lite'
).trim()

function alreadyUpdatedThisUtcMonth(lastUpdated: string | null | undefined): boolean {
  if (!lastUpdated) return false
  const lu = new Date(lastUpdated)
  if (Number.isNaN(lu.getTime())) return false
  const now = new Date()
  return lu.getUTCFullYear() === now.getUTCFullYear() && lu.getUTCMonth() === now.getUTCMonth()
}

async function readDataFromMongo(): Promise<AlgorithmSnapshotPayload | null> {
  try {
    return await readAlgorithmSnapshotFromMongo()
  } catch (error) {
    console.error('[Algorithms] MongoDB read failed:', error)
    return null
  }
}

async function writeDataToMongo(payload: AlgorithmSnapshotPayload): Promise<void> {
  const client = await clientPromise
  await client
    .db('sdhq')
    .collection(ALGORITHM_SNAPSHOT_COLLECTION)
    .updateOne(
      { _id: ALGORITHM_DOC_ID },
      {
        $set: {
          payload,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    )
  console.log('[Algorithms] Saved to MongoDB')
}

const platforms = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube-shorts', name: 'YouTube Shorts' },
  { id: 'youtube-long', name: 'YouTube Long' },
  { id: 'facebook-reels', name: 'Facebook Reels' }
]

// GitHub configuration
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username'
const GITHUB_REPO = process.env.GITHUB_REPO || 'hashy-tag-databases'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

async function readData(): Promise<AlgorithmSnapshotPayload> {
  const fromMongo = await readDataFromMongo()
  if (fromMongo) {
    console.log('[Algorithms] Loaded from MongoDB')
    return fromMongo
  }

  // GitHub mirror / legacy
  if (GITHUB_TOKEN) {
    try {
      const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      if (response.ok) {
        const fileData = await response.json()
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        console.log('[Algorithms] Loaded from GitHub')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('Error reading from GitHub:', error)
    }
  }
  
  // Fallback to local file
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    const data = await fs.readFile(filePath, 'utf-8')
    console.log('[Algorithms] Loaded from local algorithm-data.json')
    return JSON.parse(data)
  } catch (error) {
    return { data: {}, lastUpdated: null }
  }
}

async function writeData(data: AlgorithmSnapshotPayload) {
  // Mongo is source of truth — must succeed or the refresh fails (keep prior snapshot).
  await writeDataToMongo(data)

  if (GITHUB_TOKEN) {
    try {
      // Get current file SHA
      const getFileUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      const fileResponse = await fetch(getFileUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      let fileSha = null
      if (fileResponse.ok) {
        const fileData = await fileResponse.json()
        fileSha = fileData.sha
      }

      // Upload to GitHub
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
      const putUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      
      const putBody = {
        message: `Update algorithm data - ${new Date().toISOString()}`,
        content: content,
        sha: fileSha
      }

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      })

      if (!putResponse.ok) {
        throw new Error(`Failed to save to GitHub: ${putResponse.status}`)
      }
      
      console.log('Successfully saved algorithm data to GitHub')
      return
    } catch (error) {
      console.error('Error writing to GitHub:', error)
    }
  }
  
  // Fallback to local file
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing data locally:', error)
  }
}

function parseAlgorithmJsonContent(content: string): unknown {
  let cleanContent = content.trim()
  if (cleanContent.includes('```')) {
    cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  try {
    return JSON.parse(cleanContent || '{}')
  } catch {
    const balanced = extractBalancedJsonObject(cleanContent)
    if (!balanced) throw new Error('Model returned non-JSON content')
    return JSON.parse(balanced)
  }
}

function buildAlgorithmResearchPrompt(platform: string): string {
  // Mid-size monthly snapshot (~$0.02–$0.10 on Flash-Lite for all 5 platforms; budget OK to ~$0.20).
  return `You are an expert social media algorithm analyst. Research the current ${platform} recommendation system for creators (2026).

Cover, with concrete numbers where possible:
1) Ranking / distribution signals (watch time, completion, shares, saves, comments, rewatches, follows)
2) What changed recently vs outdated advice
3) Editing: length, first 1–3s hook, pacing, captions/text, trending audio, watermark/cross-post risk
4) Posting: local-time windows (give examples for US Eastern, UK, AU + say convert to local), frequency
5) Metadata: titles/captions, tag count/placement, sound-search keywords

Return ONLY valid JSON (no markdown):
{
  "keyChanges": "150-220 words: how ${platform} ranks/distributes content now + recent shifts",
  "editingTips": "150-220 words: length, pacing, hooks, on-screen text, trending audio, watermark cleanup",
  "postingTips": "150-220 words: best windows with clock times, frequency, batch vs spaced posting",
  "titleTips": "100-150 words: first-3s hook formulas, CTR/title/caption patterns that work on ${platform}",
  "descriptionTips": "100-150 words: captions, hashtag/keyword strategy (counts), sound search phrases, links/CTA",
  "summaries": [
    "insight max 8 words",
    "insight max 8 words",
    "insight max 8 words",
    "insight max 8 words",
    "insight max 8 words"
  ]
}
Be specific and actionable. Prefer current 2026 practices over generic advice.`
}

// Primary: Gemini Flash-Lite (Google AI) — cheapest stable text model for this job
async function researchWithGemini(platform: string, geminiApiKey: string): Promise<any> {
  const prompt = buildAlgorithmResearchPrompt(platform)
  console.log(`[Algorithms] Trying ${ALGORITHM_GEMINI_MODEL} for ${platform}...`)

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })
  const contents = [{ role: 'user' as const, parts: [{ text: prompt }] }]

  try {
    let response
    try {
      response = await ai.models.generateContent({
        model: ALGORITHM_GEMINI_MODEL,
        contents,
        // Avoid billed "thinking" tokens on monthly batch research
        config: {
          temperature: 0.45,
          maxOutputTokens: 2200,
          thinkingConfig: { thinkingBudget: 0 },
        } as {
          temperature?: number
          maxOutputTokens?: number
          thinkingConfig?: { thinkingBudget?: number }
        },
      })
    } catch {
      // Older SDK / model variants may reject thinkingConfig — retry plain
      response = await ai.models.generateContent({
        model: ALGORITHM_GEMINI_MODEL,
        contents,
        config: { temperature: 0.45, maxOutputTokens: 2200 },
      })
    }

    const content = typeof response.text === 'string' ? response.text : ''
    console.log(`[Algorithms] Gemini succeeded for ${platform}`)
    if (!content) throw new Error('No content in Gemini response')
    return parseAlgorithmJsonContent(content)
  } catch (error) {
    console.error(`[Algorithms] Gemini failed for ${platform}:`, error)
    throw error
  }
}

async function researchWithDeepSeekApi(
  platform: string,
  deepSeekApiKey: string,
  maxTokens: number = 2500
): Promise<any> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepSeekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert social media algorithm analyst. Return only valid JSON.',
        },
        { role: 'user', content: buildAlgorithmResearchPrompt(platform) },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in DeepSeek API response')
  }

  return parseAlgorithmJsonContent(content)
}

// Fallback: DeepSeek via RapidAPI
async function researchWithDeepSeekRapidApi(platform: string, rapidApiKey: string, maxTokens: number = 2500): Promise<any> {
  const prompt = `Research the current ${platform} algorithm and provide the following information in JSON format:
{
  "keyChanges": "Comprehensive 300-400 word analysis of how the ${platform} algorithm currently works, including ranking factors and recent changes",
  "editingTips": "Detailed editing recommendations (250-300 words) including video length, pacing, and production standards",
  "postingTips": "Comprehensive posting strategy (250-300 words) covering best times and frequency",
  "titleTips": "Title optimization guide (200-250 words)",
  "descriptionTips": "Description and hashtag optimization (200-250 words)",
  "summaries": [
    "First actionable insight - max 8 words",
    "Second actionable insight - max 8 words",
    "Third actionable insight - max 8 words",
    "Fourth actionable insight - max 8 words",
    "Fifth actionable insight - max 8 words"
  ]
}

Focus on recent changes and best practices as of 2026. Be EXTREMELY specific and actionable with concrete numbers and strategies.`

  const response = await fetch('https://deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com'
    },
    body: JSON.stringify({
      model: 'deepseek-r1-zero',
      messages: [
        { role: 'system', content: 'You are an expert in social media algorithms. Return only valid JSON without markdown code blocks.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in DeepSeek response')
  }

  return parseAlgorithmJsonContent(content)
}

/** Shown when Gemini is unavailable for algorithm research (client uses userMessage). */
const GEMINI_VACATION_USER_MESSAGE =
  "Oops! Looks like the Gemini API went on vacation. Please email our staff and we'll correct this as soon as possible. Include your username and we can credit you some free coins!"

class GeminiAlgorithmUnavailableError extends Error {
  readonly userMessage = GEMINI_VACATION_USER_MESSAGE
  constructor() {
    super('GEMINI_UNAVAILABLE')
    this.name = 'GeminiAlgorithmUnavailableError'
  }
}

/** Dedicated algo key, or shared keys used elsewhere (match Vercel naming). */
function readEnvTrim(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function resolveGeminiAlgorithmApiKey(): string | undefined {
  return (
    readEnvTrim('GEMINI_ALGORITHM_API_KEY') ||
    readEnvTrim('GEMINI_ALGO_API') ||
    readEnvTrim('GEMINI_API') ||
    undefined
  )
}

function resolveDeepSeekAlgorithmApiKey(): string | undefined {
  return readEnvTrim('DEEPSEEK_API_KEY')
}

function hasAlgorithmAiProviderConfigured(): boolean {
  return !!(
    resolveGeminiAlgorithmApiKey() ||
    resolveDeepSeekAlgorithmApiKey() ||
    readEnvTrim('RAPID_API_KEY')
  )
}

// Main research function with cascading fallbacks
async function researchAlgorithm(platform: string, maxTokens: number = 1000): Promise<any> {
  const geminiApiKey = resolveGeminiAlgorithmApiKey()
  const deepSeekApiKey = resolveDeepSeekAlgorithmApiKey()
  const rapidApiKey = readEnvTrim('RAPID_API_KEY')

  let geminiFailed = false

  // Try Gemini first (thorough analysis)
  if (geminiApiKey) {
    try {
      console.log(`[Algorithms] Trying Gemini for ${platform}...`)
      const result = await researchWithGemini(platform, geminiApiKey)
      console.log(`[Algorithms] Gemini succeeded for ${platform}`)
      return { ...result, provider: 'gemini' }
    } catch (error) {
      geminiFailed = true
      console.error(`[Algorithms] Gemini failed for ${platform}:`, error)
      if (!deepSeekApiKey && !rapidApiKey) {
        throw new GeminiAlgorithmUnavailableError()
      }
    }
  }

  // Fallback to DeepSeek's native API.
  if (deepSeekApiKey) {
    try {
      console.log(`[Algorithms] Falling back to DeepSeek API for ${platform}...`)
      const result = await researchWithDeepSeekApi(platform, deepSeekApiKey, maxTokens)
      console.log(`[Algorithms] DeepSeek API succeeded for ${platform}`)
      return { ...result, provider: 'deepseek' }
    } catch (error) {
      console.error(`[Algorithms] DeepSeek API failed for ${platform}:`, error)
    }
  }

  // Fallback to DeepSeek (RapidAPI legacy path).
  if (rapidApiKey) {
    try {
      console.log(`[Algorithms] Falling back to DeepSeek RapidAPI for ${platform}...`)
      const result = await researchWithDeepSeekRapidApi(platform, rapidApiKey, maxTokens)
      console.log(`[Algorithms] DeepSeek RapidAPI succeeded for ${platform}`)
      return { ...result, provider: 'deepseek-rapidapi' }
    } catch (error) {
      console.error(`[Algorithms] DeepSeek RapidAPI failed for ${platform}:`, error)
    }
  }

  if (geminiFailed && !deepSeekApiKey && !rapidApiKey) {
    throw new GeminiAlgorithmUnavailableError()
  }

  throw new Error(`All AI providers failed for ${platform}`)
}

// Placeholder data to show until AI research completes
const placeholderData = {
  'tiktok': {
    keyChanges: 'TikTok algorithm prioritizes watch time and engagement. Content that keeps users watching longer gets promoted. The algorithm considers likes, comments, shares, and video completion rates.',
    editingTips: 'Use trending sounds, fast cuts, and on-screen text. Hook viewers in the first 3 seconds. Keep videos under 60 seconds for best performance. Add captions for accessibility.',
    postingTips: 'Post consistently, 3-5 times a day during peak hours (7-9 AM, 12-2 PM, 5-7 PM). Test different times to find when your audience is most active.',
    titleTips: 'Use engaging questions or strong calls to action. Keep captions concise but descriptive. Use relevant hashtags (3-5) in your niche.',
    descriptionTips: 'Include relevant hashtags, ask questions to encourage comments, and use emojis strategically. Add a call-to-action to boost engagement.',
    summaries: [
      'Trending sounds boost reach',
      '3-second hooks matter most',
      'Post 3-5x daily for growth',
      'Watch time drives promotion'
    ]
  },
  'instagram': {
    keyChanges: 'Instagram algorithm favors engagement, interests, and timeliness. Reels are currently prioritized in the feed. The algorithm considers likes, comments, saves, shares, and time spent on posts.',
    editingTips: 'High-quality visuals are essential. Use trending audio for Reels. Create diverse content formats (carousels, Reels, Stories). Use text overlays for accessibility.',
    postingTips: 'Post during optimal times (11 AM-1 PM, 7-9 PM). Use all features including Reels, Stories, and Lives. Consistency is key - aim for daily posts.',
    titleTips: 'Use strong hooks, emojis, and clear value propositions. Keep feed captions short but informative. Reels can have longer, more detailed captions.',
    descriptionTips: 'Use relevant hashtags (5-10), include call-to-actions, and ask engaging questions. Utilize keywords for search optimization.',
    summaries: [
      'Reels get priority in feed',
      'Saves matter more than likes',
      'Daily posts build momentum',
      'Trending audio increases reach'
    ]
  },
  'youtube-shorts': {
    keyChanges: 'YouTube Shorts algorithm focuses on watch time, loop rate, and engagement within the Shorts feed. Shorts that get rewatched perform better. The algorithm considers views, likes, comments, and shares.',
    editingTips: 'Use vertical video format (9:16). Fast pacing with captivating hooks in the first 3 seconds. Use YouTube Shorts features like text and stickers.',
    postingTips: 'Post daily, especially during prime mobile usage hours (6-10 AM, 6-10 PM). Consistency helps build momentum with the algorithm.',
    titleTips: 'Create short, descriptive, keyword-rich titles. Include #Shorts in your title or description for better discoverability.',
    descriptionTips: 'Write brief descriptions with relevant hashtags. Link to related long-form content to drive traffic to your main videos.',
    summaries: [
      'Vertical 9:16 format required',
      'Loop rate drives promotion',
      'Daily uploads build momentum',
      'Link to long-form content'
    ]
  },
  'youtube-long': {
    keyChanges: 'YouTube long-form algorithm prioritizes watch time, audience retention, and personalized recommendations. Videos that keep viewers watching longer get recommended more.',
    editingTips: 'Focus on high-quality production with clear audio. Use engaging storytelling and strong intros/outros. Add chapters for longer videos to improve navigation.',
    postingTips: 'Maintain a consistent schedule. Optimize for SEO with relevant keywords. Promote across other platforms. Analyze audience retention data regularly.',
    titleTips: 'Create compelling, keyword-rich titles that create curiosity or clearly state value. Your thumbnail is equally important for CTR.',
    descriptionTips: 'Write detailed descriptions with keywords, timestamps, links to resources, and social media. Encourage comments and engagement.',
    summaries: [
      'Watch time is king here',
      'Thumbnails affect CTR heavily',
      'Consistent schedule builds subs',
      'Chapters improve retention'
    ]
  },
  'facebook-reels': {
    keyChanges: 'Facebook Reels algorithm emphasizes entertainment, discovery, and creator consistency. Similar to Instagram Reels. Content that sparks conversation and sharing performs better.',
    editingTips: 'Use vertical video format with trending audio. Create engaging visuals with text overlays. Keep content concise and entertaining.',
    postingTips: 'Post regularly during peak Facebook usage (9-11 AM, 1-3 PM). Cross-post from Instagram Reels for efficiency. Test different content types.',
    titleTips: 'Write catchy, benefit-driven titles. Use emojis and clear calls to action. Make it clear what value viewers will get.',
    descriptionTips: 'Include relevant hashtags, ask engaging questions, and add links to other content or products when appropriate.',
    summaries: [
      'Entertainment value is priority',
      'Cross-post from Instagram',
      'Comments drive more reach',
      'Peak times: 9-11 AM, 1-3 PM'
    ]
  }
}

function sanitizeSnapshotForClients(storedData: AlgorithmSnapshotPayload): AlgorithmSnapshotPayload {
  const data: Record<string, unknown> = {}
  for (const [id, raw] of Object.entries(storedData.data || {})) {
    const normalized = normalizeAlgorithmPlatformData(raw)
    if (normalized) data[id] = normalized
  }
  // Fill any missing platforms from placeholders so the landing never renders null crashes
  for (const p of platforms) {
    if (!data[p.id] && placeholderData[p.id as keyof typeof placeholderData]) {
      data[p.id] = placeholderData[p.id as keyof typeof placeholderData]
    }
  }
  return {
    ...storedData,
    data,
    lastUpdated: storedData.lastUpdated || new Date().toISOString(),
  }
}

export async function GET() {
  const storedData = await readData()

  // If no stored data exists, return placeholder data
  if (!storedData.lastUpdated || Object.keys(storedData.data || {}).length === 0) {
    return NextResponse.json({
      data: placeholderData,
      lastUpdated: new Date().toISOString(),
    })
  }

  return NextResponse.json(sanitizeSnapshotForClients(storedData))
}

async function logAlgorithmRefreshActivity(params: {
  ok: boolean
  skipped?: boolean
  actorUsername: string
  source: string
  details: string
  estimatedCostNote?: string
}): Promise<void> {
  const status = params.skipped ? 'SKIPPED' : params.ok ? 'SUCCESS' : 'FAILED'
  await writeActivityLogEntry({
    username: params.actorUsername,
    action: params.ok || params.skipped ? 'algorithm_refresh' : 'algorithm_refresh_failed',
    details: `[${status}] ${params.source} — ${params.details}`,
    estimatedCostNote: params.estimatedCostNote,
  })
}

/** Shared research runner used by staff POST and monthly cron (no CRON_SECRET needed). */
export async function runAlgorithmRefresh(opts?: {
  platformId?: string
  /** Cron skips if already refreshed this UTC month; staff passes force: true */
  force?: boolean
  /** Who/what triggered the run (shown in activity log). */
  source?: 'monthly-cron' | 'staff' | 'internal'
  actorUsername?: string
}): Promise<NextResponse> {
  const platformId = opts?.platformId
  const force = opts?.force === true
  const source = opts?.source || (force ? 'staff' : 'monthly-cron')
  const actorUsername = (opts?.actorUsername || 'system').trim() || 'system'

  if (!hasAlgorithmAiProviderConfigured()) {
    const error =
      'No AI API key configured for algorithm research. Set GEMINI_ALGORITHM_API_KEY (or GEMINI_ALGO_API / GEMINI_API), DEEPSEEK_API_KEY, and/or RAPID_API_KEY.'
    await logAlgorithmRefreshActivity({
      ok: false,
      actorUsername,
      source,
      details: error,
    })
    return NextResponse.json({ error }, { status: 500 })
  }

  if (platformId && !platforms.some((p) => p.id === platformId)) {
    await logAlgorithmRefreshActivity({
      ok: false,
      actorUsername,
      source,
      details: `Unknown platformId: ${platformId}`,
    })
    return NextResponse.json(
      { error: `Unknown platformId: ${platformId}` },
      { status: 400 }
    )
  }

  const existingData = await readData()

  // Once-per-month guard — only skip complete successful months (not incomplete merges)
  const priorIncomplete =
    typeof (existingData as { incomplete?: unknown }).incomplete === 'boolean'
      ? Boolean((existingData as { incomplete?: boolean }).incomplete)
      : false
  if (
    !force &&
    !platformId &&
    !priorIncomplete &&
    alreadyUpdatedThisUtcMonth(existingData.lastUpdated)
  ) {
    console.log(
      `[Algorithms] Skipping refresh — already updated this month (${existingData.lastUpdated})`
    )
    const skipNote =
      'Skipped AI calls. Full monthly refresh is ~5 Flash-Lite text calls (typically well under $0.20).'
    await logAlgorithmRefreshActivity({
      ok: true,
      skipped: true,
      actorUsername,
      source,
      details: `Already updated this month (lastUpdated: ${existingData.lastUpdated}). Next automatic run is on the 1st. Model: ${ALGORITHM_GEMINI_MODEL}.`,
      estimatedCostNote: skipNote,
    })
    return NextResponse.json({
      ...existingData,
      skipped: true,
      message: 'Already updated this month — next automatic refresh is on the 1st.',
      model: ALGORITHM_GEMINI_MODEL,
      estimatedCostNote: skipNote,
    })
  }

  // Always start from prior snapshot so a bad/partial refresh cannot wipe the app.
  const data: AlgorithmSnapshotPayload & {
    model?: string
    estimatedCostNote?: string
    incomplete?: boolean
    updatedPlatforms?: string[]
  } = {
    data: { ...(existingData.data || {}) },
    lastUpdated: existingData.lastUpdated,
    provider: existingData.provider,
    errors: existingData.errors,
  }
  const errors: string[] = []
  const updatedPlatforms: string[] = []

  const platformsToRefresh = platformId
    ? platforms.filter((p) => p.id === platformId)
    : platforms

  // Mid-size outputs for DeepSeek fallbacks too
  const maxTokens = platformId ? 2200 : 1800
  const providersUsed: string[] = []
  let geminiFullyDown = false

  for (const platform of platformsToRefresh) {
    try {
      const result = await researchAlgorithm(platform.name, maxTokens)

      if (!result) {
        errors.push(`${platform.name}: No data returned (kept previous)`)
        continue
      }

      const { provider, ...platformData } = result as Record<string, unknown> & {
        provider?: string
      }
      const normalized = normalizeAlgorithmPlatformData(platformData)
      if (!normalized) {
        errors.push(`${platform.name}: Invalid AI shape (kept previous)`)
        continue
      }

      data.data[platform.id] = normalized
      updatedPlatforms.push(platform.id)
      if (typeof provider === 'string' && provider && !providersUsed.includes(provider)) {
        providersUsed.push(provider)
      }
    } catch (error) {
      if (error instanceof GeminiAlgorithmUnavailableError) {
        geminiFullyDown = true
        errors.push(`${platform.name}: Gemini unavailable (kept previous)`)
        continue
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${platform.name}: ${errorMsg} (kept previous)`)
    }
  }

  // Nothing new validated — do not touch Mongo; leave app on last good snapshot.
  if (updatedPlatforms.length === 0) {
    const failDetails =
      errors.length > 0
        ? errors.join('; ')
        : 'No platforms returned usable data (previous snapshot preserved).'
    if (geminiFullyDown && providersUsed.length === 0) {
      await logAlgorithmRefreshActivity({
        ok: false,
        actorUsername,
        source,
        details: `Gemini unavailable. ${failDetails}`,
      })
      return NextResponse.json(
        {
          error: 'GEMINI_UNAVAILABLE',
          userMessage: GEMINI_VACATION_USER_MESSAGE,
          details: errors,
          preserved: true,
        },
        { status: 503 }
      )
    }
    await logAlgorithmRefreshActivity({
      ok: false,
      actorUsername,
      source,
      details: `Failed to research any platforms. ${failDetails}`,
    })
    return NextResponse.json(
      {
        error: 'Failed to research any platforms',
        details: errors,
        preserved: true,
        lastUpdated: existingData.lastUpdated,
      },
      { status: 500 }
    )
  }

  const allRequestedOk = updatedPlatforms.length === platformsToRefresh.length
  // Only lock the monthly skip when a full multi-platform run fully succeeds.
  if (allRequestedOk && !platformId) {
    data.lastUpdated = new Date().toISOString()
    data.incomplete = false
  } else {
    // Partial success: merge new platforms, keep prior lastUpdated so cron can retry
    // if something else triggers it; staff can force anytime.
    data.incomplete = true
    if (!data.lastUpdated) {
      data.lastUpdated = new Date().toISOString()
    }
  }

  data.provider = providersUsed.join(', ') || existingData.provider || 'unknown'
  data.model = ALGORITHM_GEMINI_MODEL
  data.errors = errors.length > 0 ? errors : undefined
  data.updatedPlatforms = updatedPlatforms
  data.estimatedCostNote =
    'Rough: 5× gemini-2.5-flash-lite mid-size calls ≈ ~$0.02–$0.10/month (budget ~$0.20).'

  try {
    await writeData(data)
  } catch (error) {
    console.error('[Algorithms] Persist failed — leaving previous snapshot in place:', error)
    await logAlgorithmRefreshActivity({
      ok: false,
      actorUsername,
      source,
      details: `Research produced updates for ${updatedPlatforms.join(', ')} but Mongo save failed: ${
        error instanceof Error ? error.message : 'Mongo write failed'
      }. Previous snapshot preserved.`,
      estimatedCostNote: data.estimatedCostNote,
    })
    return NextResponse.json(
      {
        error: 'Failed to save algorithm snapshot',
        details: error instanceof Error ? error.message : 'Mongo write failed',
        preserved: true,
      },
      { status: 500 }
    )
  }

  const scope = platformId ? `platform ${platformId}` : 'all platforms'
  const successDetails = allRequestedOk
    ? `Updated ${scope} successfully. Provider: ${data.provider}. Model: ${ALGORITHM_GEMINI_MODEL}. Platforms: ${updatedPlatforms.join(', ')}. lastUpdated: ${data.lastUpdated}.`
    : `Partial update for ${scope}. Updated: ${updatedPlatforms.join(', ')}. Issues: ${errors.join('; ') || 'none'}. Prior data kept for failed platforms. Provider: ${data.provider}. Model: ${ALGORITHM_GEMINI_MODEL}.`

  await logAlgorithmRefreshActivity({
    ok: true,
    actorUsername,
    source,
    details: successDetails,
    estimatedCostNote: data.estimatedCostNote,
  })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get(INTERNAL_API_SECRET_HEADER)
  let source: 'staff' | 'internal' = 'internal'
  let actorUsername = 'system'

  if (!isValidInternalApiSecret(internalSecret)) {
    try {
      const staff = await verifyStaffUser(request)
      source = 'staff'
      actorUsername = staff.username
    } catch (error) {
      if (error instanceof AuthError) return createAuthErrorResponse(error)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    platformId?: unknown
    force?: unknown
  }
  const platformId = typeof body.platformId === 'string' ? body.platformId : undefined
  // Staff / internal refreshes always force (manual control)
  return runAlgorithmRefresh({ platformId, force: true, source, actorUsername })
}
