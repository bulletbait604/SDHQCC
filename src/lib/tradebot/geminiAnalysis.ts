import { GoogleGenAI } from '@google/genai'
import type { TradebotOpportunity } from '@/lib/tradebot/types'

export async function summarizeTradebotOpportunities(
  opportunities: TradebotOpportunity[]
): Promise<string | null> {
  const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey || opportunities.length === 0) return null

  const top = opportunities.slice(0, 8).map((o) => ({
    kind: o.kind,
    symbol: o.symbol,
    netEdgeBps: o.netEdgeBps,
    venues: `${o.venueA} vs ${o.venueB}`,
    note: o.note,
  }))

  const prompt = `You are a trading analyst assistant for a Canadian investor using TD Direct Investing (stocks) and Bitbuy (crypto).
Given these detected market gaps (basis points = 0.01%), write 2-4 short bullet points:
- Which gaps look actionable vs noise
- Remind that TD has no API (manual trades only)
- Flag risks (fees, liquidity, stale data)
Do not invent prices. Be concise.

Data JSON:
${JSON.stringify(top, null, 2)}`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const model = (process.env.TRADEBOT_GEMINI_MODEL || 'gemini-2.5-flash').trim()
    const res = await ai.models.generateContent({ model, contents: prompt })
    const text = res.text?.trim()
    return text || null
  } catch (error) {
    console.warn('[tradebot] Gemini summary failed:', error)
    return null
  }
}
