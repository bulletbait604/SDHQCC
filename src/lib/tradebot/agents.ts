import { GoogleGenAI } from '@google/genai'
import { extractBalancedJsonObject } from '@/lib/algorithmPlatformNormalize'
import type { SignalAnalysis } from '@/lib/tradebot/indicators'
import type { AgentDecision, TradeAction } from '@/lib/tradebot/models'
import { tradebotGeminiKey, tradebotGeminiModel } from '@/lib/tradebot/settings'

function geminiText(response: { text?: string }): string {
  if (typeof response.text === 'string' && response.text.trim()) return response.text
  const rec = response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = rec.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim()
}

function asAction(raw: unknown): TradeAction {
  const v = String(raw || '').toUpperCase()
  if (v === 'BUY' || v === 'SELL' || v === 'HOLD') return v
  return 'HOLD'
}

function asStringArray(value: unknown, max = 4): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 180))
    .slice(0, max)
}

export async function runDebateAndTrader(signals: SignalAnalysis[]): Promise<AgentDecision[]> {
  const apiKey = tradebotGeminiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const genAI = new GoogleGenAI({ apiKey })
  const model = tradebotGeminiModel()
  const payload = signals.map((s) => ({
    ticker: s.ticker,
    price: s.price,
    previousClose: s.previousClose,
    technical_signal: s.technical_signal,
    rsi_14: s.rsi_14,
    macd_histogram: s.macd_histogram,
    sma_20: s.sma_20,
    sma_50: s.sma_50,
    atr: s.atr,
    key_support: s.key_support,
    key_resistance: s.key_resistance,
    dayChangePct: s.previousClose
      ? Number((((s.price - s.previousClose) / s.previousClose) * 100).toFixed(2))
      : 0,
  }))

  const prompt = `You are four desks on a Canadian CAD paper book (TSX names, Toronto session):
1) Sentiment analyst  2) Bull researcher  3) Bear researcher  4) Trader
Never place an order yourself. Output JSON only.

For each ticker, do a 2-turn bull vs bear debate, then the trader picks BUY, SELL, or HOLD.
SELL is only valid to exit an existing long (the engine will reject shorts). Prefer HOLD unless conviction is clear.
CAD book, TSX-listed ETFs and stocks. Be conservative.

Return:
{"decisions":[{"ticker":"VFV.TO","sentiment_score":0.1,"confidence":0.5,"bull_points":[""],"bear_points":[""],"consensus_rating":0,"action":"HOLD","reasoning_summary":""}]}

sentiment_score is -1 to 1. consensus_rating is -10 to 10.
Tickers and technicals:
${JSON.stringify(payload)}`

  const response = await genAI.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.3 },
  })
  const raw = geminiText(response as { text?: string })
  const json = extractBalancedJsonObject(raw)
  if (!json) throw new Error('Gemini returned no JSON decisions')
  const parsed = JSON.parse(json) as { decisions?: unknown }
  const rows = Array.isArray(parsed.decisions) ? parsed.decisions : []
  const byTicker = new Map<string, AgentDecision>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const ticker = String(rec.ticker || '').trim().toUpperCase()
    if (!ticker) continue
    const sentiment = Number(rec.sentiment_score)
    const consensus = Number(rec.consensus_rating)
    byTicker.set(ticker, {
      ticker,
      sentiment_score: Number.isFinite(sentiment) ? Math.max(-1, Math.min(1, sentiment)) : 0,
      confidence: Number.isFinite(Number(rec.confidence)) ? Number(rec.confidence) : 0.5,
      bull_points: asStringArray(rec.bull_points),
      bear_points: asStringArray(rec.bear_points),
      consensus_rating: Number.isFinite(consensus) ? Math.max(-10, Math.min(10, consensus)) : 0,
      action: asAction(rec.action),
      reasoning_summary: String(rec.reasoning_summary || '').trim().slice(0, 400),
    })
  }

  return signals.map((s) => {
    const d = byTicker.get(s.ticker)
    if (d) return d
    return {
      ticker: s.ticker,
      sentiment_score: 0,
      confidence: 0,
      bull_points: [],
      bear_points: ['Model skipped this name'],
      consensus_rating: 0,
      action: 'HOLD',
      reasoning_summary: 'No model decision; default HOLD.',
    }
  })
}
