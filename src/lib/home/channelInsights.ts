import { GoogleGenAI } from '@google/genai'
import {
  extractSocialsFromText,
  extractUrls,
  isFetchableProfilePage,
  type ExtractedSocial,
} from '@/lib/kick/extractSocials'
import type { ChannelInsights } from '@/lib/home/channelInsightsTypes'

export type { ChannelInsights }

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/json',
        'User-Agent': 'SDHQCC/1.0 (Creator Corner channel insights)',
      },
    })
    if (!response.ok) return ''
    const text = await response.text()
    return stripHtml(text).slice(0, 4000)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

function parseInsightsJson(raw: string, fallbackSocials: ExtractedSocial[]): ChannelInsights {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : '{}'
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(slice) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  const games = Array.isArray(parsed.favoriteGames)
    ? parsed.favoriteGames.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    : []
  const socialsFromModel = Array.isArray(parsed.socials)
    ? parsed.socials
        .map((row) => {
          if (!row || typeof row !== 'object') return null
          const rec = row as Record<string, unknown>
          const network = typeof rec.network === 'string' ? rec.network : null
          const url = typeof rec.url === 'string' ? rec.url : ''
          if (!network) return null
          return {
            network,
            username: typeof rec.username === 'string' ? rec.username : null,
            url,
          } satisfies ExtractedSocial
        })
        .filter((row): row is ExtractedSocial => Boolean(row))
    : []

  return {
    streamerBackground:
      (typeof parsed.streamerBackground === 'string' && parsed.streamerBackground.trim()) ||
      'Not enough public bio text to summarize a background yet.',
    gameStyles:
      (typeof parsed.gameStyles === 'string' && parsed.gameStyles.trim()) ||
      'Not listed on the Kick about section.',
    favoriteGames: games.slice(0, 8),
    schedule:
      (typeof parsed.schedule === 'string' && parsed.schedule.trim()) ||
      'No public schedule found.',
    socials: (socialsFromModel.length ? socialsFromModel : fallbackSocials).slice(0, 12),
    sourceNotes:
      (typeof parsed.sourceNotes === 'string' && parsed.sourceNotes.trim()) ||
      'Summarized from the Kick about section and public profile links.',
  }
}

export async function buildChannelInsights(input: {
  username: string
  displayName: string
  description: string
  recentCategories?: string[]
}): Promise<ChannelInsights> {
  const linked = extractSocialsFromText(input.description)
  const extraPages: string[] = []
  for (const social of linked) {
    if (!isFetchableProfilePage(social.url)) continue
    extraPages.push(await fetchPageText(social.url))
  }
  const recentCategories = (input.recentCategories || []).filter(Boolean)

  const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  const fallback: ChannelInsights = {
    streamerBackground: input.description.trim()
      ? input.description.trim().slice(0, 400)
      : 'This Kick about section is empty, so we cannot infer a background yet.',
    gameStyles: recentCategories.length ? `Recently streamed: ${recentCategories.join(', ')}.` : 'Not listed yet.',
    favoriteGames: recentCategories.slice(0, 8),
    schedule: 'No public schedule found.',
    socials: linked,
    sourceNotes: extraPages.some(Boolean)
      ? 'Used Kick about text plus a public link-in-bio page.'
      : 'Used Kick about text only. Closed social apps are not scraped.',
  }

  if (!apiKey) return fallback

  const model = process.env.CHANNEL_INSIGHTS_MODEL?.trim() || 'gemini-2.5-flash-lite'
  const genAI = new GoogleGenAI({ apiKey })
  const prompt = `Summarize this Kick streamer's public about section into compact JSON.
Return ONLY JSON with keys:
streamerBackground (2-3 sentences),
gameStyles (one short sentence),
favoriteGames (array of game names),
schedule (one short sentence or "No public schedule found."),
socials (array of {network, username, url}),
sourceNotes (one sentence about what was used).

Do not invent games, times, or usernames that are not supported by the text.
Kick username: ${input.username}
Display name: ${input.displayName}
Recent Kick categories: ${recentCategories.join(', ') || '(none)'}
About text:
${input.description.slice(0, 3500)}

Extracted links:
${extractUrls(input.description).join('\n') || '(none)'}

Optional extra public pages:
${extraPages.filter(Boolean).join('\n---\n').slice(0, 3500) || '(none)'}
`

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const raw = typeof response.text === 'string' ? response.text : ''
    if (!raw.trim()) return fallback
    return parseInsightsJson(raw, linked)
  } catch (error) {
    console.warn('[channelInsights] Gemini failed:', error)
    return fallback
  }
}
