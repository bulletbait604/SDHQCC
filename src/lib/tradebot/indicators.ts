export type Candle = {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

function last(values: number[], n: number): number[] {
  return values.slice(-n)
}

export function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = last(closes, period)
  return slice.reduce((a, b) => a + b, 0) / period
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gains = 0
  let losses = 0
  const start = closes.length - period - 1
  for (let i = start + 1; i <= start + period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gains += d
    else losses -= d
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    if (!prev) continue
    trs.push(Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c)))
  }
  if (trs.length < period) return null
  return trs.reduce((a, b) => a + b, 0) / trs.length
}

export function macdHistogram(closes: number[]): number | null {
  if (closes.length < 35) return null
  const ema = (period: number) => {
    const k = 2 / (period + 1)
    let val = closes[0]
    for (let i = 1; i < closes.length; i++) val = closes[i] * k + val * (1 - k)
    return val
  }
  const macdLine = ema(12) - ema(26)
  // Approximate signal as slower EMA of MACD via 9-period on closes spread — use last 9 MACD-like diffs
  const k9 = 2 / 10
  let signal = macdLine
  for (let i = closes.length - 9; i < closes.length; i++) {
    const fast = closes.slice(0, i + 1)
    if (fast.length < 26) continue
    const line = (() => {
      const k12 = 2 / 13
      const k26 = 2 / 27
      let e12 = fast[0]
      let e26 = fast[0]
      for (let j = 1; j < fast.length; j++) {
        e12 = fast[j] * k12 + e12 * (1 - k12)
        e26 = fast[j] * k26 + e26 * (1 - k26)
      }
      return e12 - e26
    })()
    signal = line * k9 + signal * (1 - k9)
  }
  return macdLine - signal
}

export type TechnicalSignal = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

export type SignalAnalysis = {
  ticker: string
  price: number
  previousClose: number
  technical_signal: TechnicalSignal
  rsi_14: number
  macd_histogram: number
  sma_20: number | null
  sma_50: number | null
  atr: number
  key_support: number
  key_resistance: number
  assetClass?: 'equity' | 'crypto'
  highPotential?: boolean
  isNewListing?: boolean
  newsTone?: 'positive' | 'negative' | 'mixed' | 'quiet'
  headlines?: string[]
}

export function analyzeCandles(ticker: string, candles: Candle[], price: number, previousClose: number): SignalAnalysis | null {
  if (!(price > 0)) return null
  const closes = candles.map((c) => c.c).filter((n) => Number.isFinite(n) && n > 0)
  const rsiVal = rsi(closes) ?? 50
  const macd = macdHistogram(closes) ?? 0
  const atrVal = atr(candles) ?? price * (closes.length < 20 ? 0.04 : 0.015)
  const sma20 = sma(closes, 20)
  const sma50 = sma(closes, 50)
  const recent = last(closes, Math.min(20, Math.max(1, closes.length)))
  const key_support = recent.length ? Math.min(...recent) : price
  const key_resistance = recent.length ? Math.max(...recent) : price

  let technical_signal: TechnicalSignal = 'NEUTRAL'
  if (rsiVal >= 55 && macd > 0 && (!sma20 || price >= sma20)) technical_signal = 'BULLISH'
  else if (rsiVal <= 45 && macd < 0 && (!sma20 || price <= sma20)) technical_signal = 'BEARISH'

  return {
    ticker,
    price,
    previousClose,
    technical_signal,
    rsi_14: Number(rsiVal.toFixed(2)),
    macd_histogram: Number(macd.toFixed(4)),
    sma_20: sma20 ? Number(sma20.toFixed(4)) : null,
    sma_50: sma50 ? Number(sma50.toFixed(4)) : null,
    atr: Number(atrVal.toFixed(4)),
    key_support: Number(key_support.toFixed(4)),
    key_resistance: Number(key_resistance.toFixed(4)),
    highPotential: false,
    isNewListing: false,
    newsTone: 'quiet',
    headlines: [],
  }
}
