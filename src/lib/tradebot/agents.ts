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

export async function runDebateAndTrader(
  signals: SignalAnalysis[],
  industryTape: string[] = [],
  book: {
    equity: number
    cash: number
    dayStartEquity: number
    dayPnlPct: number
    startingCad: number
    targetMinPct: number
    targetMaxPct: number
    openPositions: Array<{ symbol: string; qty: number; avgPrice: number }>
  }
): Promise<AgentDecision[]> {
  const apiKey = tradebotGeminiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const genAI = new GoogleGenAI({ apiKey })
  const model = tradebotGeminiModel()
  const payload = signals.map((s) => ({
    ticker: s.ticker,
    assetClass: s.assetClass || 'equity',
    highPotential: Boolean(s.highPotential),
    isNewListing: Boolean(s.isNewListing),
    isMeme: Boolean(s.isMeme),
    isTrending: Boolean(s.isTrending),
    change1h: s.change1h || 0,
    newsTone: s.newsTone || 'quiet',
    headlines: (s.headlines || []).slice(0, 3),
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

  const prompt = `You are four desks on a Canadian CAD paper book of CA$${book.startingCad.toFixed(2)} fake currency:
1) ARCHIVE (news + industry)  2) FORGE (bull)  3) RELAY (bear)  4) HELM (trader)
Never place an order yourself. Output JSON only. This is paper P&L only — no live broker.

GOAL: make at least +${book.targetMinPct}% CAD profit TODAY vs Toronto day-open NAV. Keep going if it is working. Hard ceiling is +${book.targetMaxPct}% — then no new buys.
Current book: equity CA$${book.equity.toFixed(2)}, cash CA$${book.cash.toFixed(2)}, day-open CA$${book.dayStartEquity.toFixed(2)}, day P&L ${book.dayPnlPct.toFixed(2)}%.

Hunt NEW coins and MEME coins across a WIDE set of names — not just BTC/ETH/PEPE.
Let winners RUN. Do not scalp out a few percent. Paper take-profit ceiling is ~+${book.targetMaxPct}% from entry (3x).
Cross-reference 1h/24h tape with headlines AND live web search.
Do not invent headlines. Rugs, hacks, honeypots, exploits = never BUY.

Open paper longs (let these run unless the thesis broke):
${JSON.stringify(book.openPositions.slice(0, 12))}

Rules:
- SELL only exits a long. No shorts.
- BUY more names that look like high-potential memes/new coins when 1h or 24h is still up AND news is not negative. Quiet news is OK on a trending meme with strong volume; still say why.
- newsTone negative (rug, hack, exploit, scam, halt) = HOLD or SELL, never BUY.
- BTC/ETH are hedges, not the hunt.
- Open longs that are still up on 1h/24h with non-negative news: HOLD. Do not SELL just because they are green.
- SELL an open long only if news flipped negative or the move clearly failed (broke down vs the 1h tape).
- If day P&L is already >= ${book.targetMinPct}%, HOLD winners rather than dumping them. If day P&L is >= ${book.targetMaxPct}%, action must be HOLD or SELL — never BUY.
- Aim for continuation into a larger pop, not a tiny scalp.

Industry tape:
${JSON.stringify(industryTape.slice(0, 8))}

Return:
{"decisions":[{"ticker":"PEPE-CAD","sentiment_score":0.1,"confidence":0.5,"bull_points":[""],"bear_points":[""],"consensus_rating":0,"action":"HOLD","reasoning_summary":""}]}

sentiment_score is -1 to 1. consensus_rating is -10 to 10. reasoning_summary must mention the news/industry cross-check in one sentence.
Tickers, technicals, and news:
${JSON.stringify(payload)}`

  const contents = [{ role: 'user' as const, parts: [{ text: prompt }] }]
  let raw = ''
  try {
    const grounded = await genAI.models.generateContent({
      model,
      contents,
      config: { temperature: 0.3, tools: [{ googleSearch: {} }] },
    })
    raw = geminiText(grounded as { text?: string })
  } catch (err) {
    console.warn('[tradebot] Google Search grounding failed, debating without search', err)
  }
  if (!raw.trim()) {
    const response = await genAI.models.generateContent({
      model,
      contents,
      config: { temperature: 0.3 },
    })
    raw = geminiText(response as { text?: string })
  }
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
