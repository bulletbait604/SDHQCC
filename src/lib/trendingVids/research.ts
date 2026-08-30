import { GoogleGenAI } from '@google/genai'
import { extractBalancedJsonObject } from '@/lib/algorithmPlatformNormalize'
import {
  getTrendingVidsPlatform,
  isTrendingVidsKind,
  normalizeTrendingVidsPrompt,
  type TrendingVidsKind,
  type TrendingVidsPlatform,
} from '@/lib/trendingVids/platforms'

export const TRENDING_VIDS_MODEL_DEFAULT = 'gemini-2.5-flash'
export const TRENDING_VIDS_COUNT = 5

export type TrendingVidsSource = {
  title: string
  uri: string
}

export type TrendItem = {
  rank: number
  kind: TrendingVidsKind
  title: string
  summary: string
  whyTrending: string
  creator: string
  url: string
  tags: string[]
  metric: string
}

export type TrendingVidsResult = {
  platformId: string
  platformName: string
  researchedAt: string
  overview: string
  prompt: string
  trends: TrendItem[]
  sources: TrendingVidsSource[]
  searchQueries: string[]
  model: string
  usedGoogleSearch: boolean
}

function geminiText(response: { text?: string }): string {
  if (typeof response.text === 'string' && response.text.trim()) return response.text
  const rec = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const parts = rec.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n')
    .trim()
}

function asTrimmed(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function asStringArray(value: unknown, maxItems = 8, maxLen = 80): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const t = item.trim().replace(/^#+/, '').trim().slice(0, maxLen)
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= maxItems) break
  }
  return out
}

function sanitizeHttpUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.toString().slice(0, 500)
  } catch {
    return ''
  }
}

function inferKind(
  rawKind: unknown,
  platform: TrendingVidsPlatform,
  title: string
): TrendingVidsKind {
  if (typeof rawKind === 'string' && isTrendingVidsKind(rawKind.toLowerCase())) {
    return rawKind.toLowerCase() as TrendingVidsKind
  }
  const t = title.toLowerCase()
  if (t.startsWith('#') || t.includes('hashtag')) return 'hashtag'
  if (t.includes('sound') || t.includes('audio')) return 'sound'
  if (platform.surface === 'video') return 'topic'
  return 'topic'
}

export function parseTrendingVidsJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const balanced = extractBalancedJsonObject(trimmed)
    if (!balanced) throw new Error('Model returned non-JSON trend research')
    return JSON.parse(balanced)
  }
}

export function normalizeTrendItem(
  raw: unknown,
  rank: number,
  platform: TrendingVidsPlatform
): TrendItem | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const title = asTrimmed(rec.title, 180)
  if (title.length < 2) return null

  const summary =
    asTrimmed(rec.summary, 400) || asTrimmed(rec.description, 400)
  const whyTrending =
    asTrimmed(rec.whyTrending, 400) || asTrimmed(rec.why, 400)

  return {
    rank,
    kind: inferKind(rec.kind, platform, title),
    title,
    summary,
    whyTrending,
    creator: asTrimmed(rec.creator, 120) || asTrimmed(rec.channel, 120),
    url: sanitizeHttpUrl(rec.url) || sanitizeHttpUrl(rec.link),
    tags: asStringArray(rec.tags ?? rec.hashtags),
    metric: asTrimmed(rec.metric, 80) || asTrimmed(rec.views, 80),
  }
}

export function normalizeTrendingVidsResult(params: {
  raw: unknown
  platform: TrendingVidsPlatform
  sources: TrendingVidsSource[]
  searchQueries: string[]
  model: string
  usedGoogleSearch: boolean
  researchedAt?: string
  prompt?: string
}): TrendingVidsResult | null {
  const rec =
    params.raw && typeof params.raw === 'object'
      ? (params.raw as Record<string, unknown>)
      : null
  if (!rec) return null

  const list = Array.isArray(rec.trends) ? rec.trends : []
  const trends: TrendItem[] = []
  for (const item of list) {
    const next = normalizeTrendItem(item, trends.length + 1, params.platform)
    if (!next) continue
    trends.push(next)
    if (trends.length >= TRENDING_VIDS_COUNT) break
  }

  if (trends.length < 3) return null

  return {
    platformId: params.platform.id,
    platformName: params.platform.name,
    researchedAt: params.researchedAt || new Date().toISOString(),
    overview: asTrimmed(rec.overview, 500),
    prompt: normalizeTrendingVidsPrompt(params.prompt),
    trends,
    sources: params.sources.slice(0, 8),
    searchQueries: params.searchQueries.slice(0, 8),
    model: params.model,
    usedGoogleSearch: params.usedGoogleSearch,
  }
}

function extractGrounding(response: unknown): {
  sources: TrendingVidsSource[]
  searchQueries: string[]
} {
  const rec = response as {
    candidates?: Array<{
      groundingMetadata?: {
        webSearchQueries?: unknown
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      }
    }>
  }
  const meta = rec.candidates?.[0]?.groundingMetadata
  const sources: TrendingVidsSource[] = []
  const seen = new Set<string>()
  for (const chunk of meta?.groundingChunks || []) {
    const uri = sanitizeHttpUrl(chunk.web?.uri)
    if (!uri || seen.has(uri)) continue
    seen.add(uri)
    sources.push({
      title: asTrimmed(chunk.web?.title, 160) || uri,
      uri,
    })
  }

  const searchQueries = asStringArray(meta?.webSearchQueries, 8, 160)
  return { sources, searchQueries }
}

function buildResearchPrompt(
  platform: TrendingVidsPlatform,
  today: string,
  userPrompt: string
): string {
  const videoRule =
    platform.surface === 'video'
      ? `This is a VIDEO platform. For each of the 5 items, prefer a named trending video (title + creator/channel) when search results name one. Otherwise use a trending topic, sound, or hashtag. Set kind to "video" | "topic" | "hashtag" | "sound".`
      : `This is a SOCIAL/DISCUSSION platform. List trending topics, hashtags, or posts. Set kind to "topic" | "hashtag" | "post" | "video" if a named clip is actually trending.`

  const safeFocus = userPrompt.replace(/"""/g, '"')
  const focusBlock = safeFocus
    ? `CREATOR FOCUS — steer search queries and ranking toward this (do not invent matches that search did not surface):
"""
${safeFocus}
"""
Run extra searches that combine this focus with ${platform.name} trending (niche, format, game, audience, or angle). Prefer the 5 trends that best match the focus. If the niche is thin, pick the closest current trends and say so in overview.`
    : `No extra focus — report the general top trends on ${platform.name}.`

  const focusSearch = safeFocus
    ? `- "${platform.name} ${safeFocus.slice(0, 80)} trending today"`
    : `- "${platform.name} viral this week"`

  return `You are a social-video trend researcher for creators. Today's date is ${today} (UTC).

Use Google Search for CURRENT ${platform.name} trends — not training-cutoff memory.
Run searches such as:
- "${platform.name} trending today ${today}"
- "${platform.name} trending videos"
${focusSearch}

${focusBlock}

${platform.searchHint}

${videoRule}

Return ONLY valid JSON (no markdown fences):
{
  "overview": "1-2 sentences: what is popping on ${platform.name} right now${safeFocus ? ' for this creator focus' : ''}",
  "trends": [
    {
      "rank": 1,
      "kind": "video",
      "title": "Exact video/topic/hashtag name",
      "creator": "Channel, creator, subreddit, or account if known else empty string",
      "summary": "What it is, in one sentence",
      "whyTrending": "Why it is trending right now",
      "url": "https://... if a real URL appeared in search, else empty string",
      "tags": ["optional", "hashtags"],
      "metric": "view count, rank region, or empty string"
    }
  ]
}

Rules:
- Exactly 5 items in "trends", ranked 1–5.
- Do not invent specific video titles, view counts, or URLs that search did not surface.
- If a named video is not in search results, use kind "topic" and describe the trend generally.
- URLs must be real http(s) links from search, or empty string.
- Be specific and useful for a creator deciding what to make next.
- If a creator focus is set, make overview and ranking directly about that focus.`
}

async function generateWithOptionalSearch(params: {
  genAI: GoogleGenAI
  model: string
  prompt: string
  useGoogleSearch: boolean
}): Promise<{ text: string; usedGoogleSearch: boolean; response: unknown }> {
  const contents = [{ role: 'user' as const, parts: [{ text: params.prompt }] }]
  const baseConfig = {
    temperature: 0.35,
    maxOutputTokens: 4096,
  }

  if (params.useGoogleSearch) {
    try {
      const response = await params.genAI.models.generateContent({
        model: params.model,
        contents,
        config: {
          ...baseConfig,
          tools: [{ googleSearch: {} }],
        },
      })
      const text = geminiText(response as { text?: string })
      if (text.trim()) {
        return { text, usedGoogleSearch: true, response }
      }
    } catch (err) {
      console.warn('[trending-vids] Google Search grounding failed, retrying without search:', err)
    }
  }

  const response = await params.genAI.models.generateContent({
    model: params.model,
    contents,
    config: baseConfig,
  })
  const text = geminiText(response as { text?: string })
  if (!text.trim()) throw new Error('Gemini returned empty trend research')
  return { text, usedGoogleSearch: false, response }
}

export async function researchTrendingVids(params: {
  platformId: string
  prompt?: string
  apiKey?: string
  modelId?: string
}): Promise<TrendingVidsResult> {
  const platform = getTrendingVidsPlatform(params.platformId)
  if (!platform) throw new Error('Choose a valid platform.')

  const userPrompt = normalizeTrendingVidsPrompt(params.prompt)

  const apiKey =
    params.apiKey?.trim() ||
    (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const model =
    (params.modelId || process.env.TRENDING_VIDS_MODEL || TRENDING_VIDS_MODEL_DEFAULT).trim() ||
    TRENDING_VIDS_MODEL_DEFAULT

  const today = new Date().toISOString().slice(0, 10)
  const genAI = new GoogleGenAI({ apiKey })
  const { text, usedGoogleSearch, response } = await generateWithOptionalSearch({
    genAI,
    model,
    prompt: buildResearchPrompt(platform, today, userPrompt),
    useGoogleSearch: true,
  })

  const parsed = parseTrendingVidsJson(text)
  const grounding = extractGrounding(response)
  const normalized = normalizeTrendingVidsResult({
    raw: parsed,
    platform,
    sources: grounding.sources,
    searchQueries: grounding.searchQueries,
    model,
    usedGoogleSearch,
    prompt: userPrompt,
  })

  if (!normalized) {
    throw new Error(`Could not parse ${TRENDING_VIDS_COUNT} current trends for ${platform.name}.`)
  }
  return normalized
}
