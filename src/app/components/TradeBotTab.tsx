'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import { TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV } from '@/lib/tradebot/canada'
import type { TradebotProviderStatus } from '@/lib/tradebot/envCatalog'
import './TradeBotFloor.css'

export interface TradeBotTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
}

type Position = {
  symbol: string
  qty: number
  avgPrice: number
  stopLoss: number
  takeProfit: number
}

type FillRow = {
  at: string
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  notionalCad: number
  feeCad: number
  reason: string
}

type DecisionRow = {
  ticker: string
  signal: string
  price: number
  proposal: {
    action: string
    quantity: number
    stop_loss: number
    take_profit: number
    reasoning_summary: string
  }
  risk: { approved: boolean; rejection_reasons: string[] }
  fill: {
    filled: boolean
    side: string
    quantity: number
    price: number
    notionalCad: number
    note: string
  } | null
}

type CycleView = {
  ranAt: string
  halted: boolean
  haltReason: string
  equity: number
  cash: number
  drawdownPct: number
  dayPnlPct?: number
  profitLocked?: boolean
  dayStartEquity?: number
  ledger: { cash: number; positions: Position[]; halted?: boolean; haltReason?: string; dayStartEquity?: number }
  decisions: DecisionRow[]
  scan?: {
    universe: number
    scannedThisCycle: number
    newListings: number
    cryptoPairs: number
    shortlist: string[]
    highPotential?: string[]
    newsItems?: number
    industryTape?: string[]
  }
}

type StatusResponse = {
  engineReady: boolean
  paperOnly: boolean
  paper?: boolean
  region: 'CA'
  baseCurrency: 'CAD'
  quotesOk?: boolean
  quoteProbe?: { ok: boolean; source?: string; symbol: string; price?: number; error?: string }
  cryptoProbe?: { ok: boolean; source?: string; symbol: string; price?: number; error?: string }
  universe?: { universe: number; newListings: number; offset: number }
  providers: TradebotProviderStatus[]
  equity?: number | null
  ledger?: { cash: number; positions: Position[]; halted?: boolean; haltReason?: string; dayStartEquity?: number } | null
  fills?: FillRow[]
  lastCycle?: CycleView | null
  startingCad?: number
  dailyProfitTargetMinPct?: number
  dailyProfitTargetMaxPct?: number
  cycleMinutes?: number
  dayPnlPct?: number
  profitLocked?: boolean
  error?: string
  userMessage?: string
}

const ENV_SNIPPET = `TRADEBOT_PAPER=true
TRADEBOT_GEMINI_MODEL=gemini-2.5-flash
TRADEBOT_MAX_DRAWDOWN_PCT=5
TRADEBOT_MAX_ASSET_WEIGHT=25
TRADEBOT_RISK_PCT=2
TRADEBOT_STARTING_CAD=100
TRADEBOT_DAILY_PROFIT_MIN_PCT=8
TRADEBOT_DAILY_PROFIT_MAX_PCT=10
TRADEBOT_CRYPTO_ONLY=true
TRADEBOT_CRYPTO=true
TRADEBOT_CRYPTO_WATCHLIST=${TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV}
TRADEBOT_SHORTLIST_CRYPTO=20
TRADEBOT_CYCLE_MINUTES=60
COINGECKO_DEMO_API_KEY=`

const AGENTS = [
  { id: 'scout', name: 'FINDER', role: 'Looks for coins', idle: 'Looking for coins that might go up today.', color: '#9ddd55', x: '18%', y: '28%' },
  { id: 'archive', name: 'NEWS', role: 'Reads the news', idle: 'Checking the news for scams.', color: '#be91ff', x: '50%', y: '22%' },
  { id: 'forge', name: 'YES', role: 'Why we might buy', idle: 'Looking for good reasons to buy.', color: '#42cbbb', x: '82%', y: '28%' },
  { id: 'relay', name: 'NO', role: 'Why we might wait', idle: 'Looking for reasons not to buy.', color: '#58a9e8', x: '22%', y: '68%' },
  { id: 'helm', name: 'TRADER', role: 'Buys and sells', idle: 'Waiting to buy or sell with fake money.', color: '#ff6557', x: '50%', y: '74%' },
  { id: 'sentinel', name: 'SAFETY', role: 'Stops big losses', idle: 'Stops new buys if we lose 5% or already made 10% today.', color: '#d6a56e', x: '78%', y: '68%' },
] as const

const STAGES = AGENTS.map((a) => a.id)

function cad(n: number): string {
  return `CA$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function actionWord(action: string): string {
  const a = action.toUpperCase()
  if (a === 'BUY') return 'Bought'
  if (a === 'SELL') return 'Sold'
  return 'Held'
}

function coinName(symbol: string): string {
  return symbol.replace(/-CAD$/i, '')
}

function plainNote(text: string): string {
  const t = text || ''
  if (/Paper CAD fill/i.test(t)) return t.replace(/Paper CAD fill · /i, 'Fee ')
  if (/HOLD — no order/i.test(t) || /HOLD - no order/i.test(t)) return 'Did not buy or sell.'
  if (/Blocked by guardrails/i.test(t)) return 'Safety said no.'
  if (/drawdown/i.test(t)) return 'Stopped for today: fake money dropped about 5%.'
  if (/profit lock/i.test(t)) return 'Already hit today’s profit goal. No new buys until tomorrow.'
  if (/Hard exit/i.test(t)) return t.replace(/Hard exit · /i, 'Sold because: ')
  return t
}

export default function TradeBotTab({ description }: TradeBotTabProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [cycle, setCycle] = useState<CycleView | null>(null)
  const [fills, setFills] = useState<FillRow[]>([])
  const [selected, setSelected] = useState<(typeof AGENTS)[number]['id']>('helm')
  const [phase, setPhase] = useState<(typeof AGENTS)[number]['id'] | 'idle' | 'done'>('idle')
  const [showVars, setShowVars] = useState(false)
  const runningRef = useRef(false)

  const loadStatus = async () => {
    const res = await fetch('/api/tradebot/status', { credentials: 'include' })
    const data = await parseJsonResponse<StatusResponse>(res)
    if (!res.ok) throw new Error(data.error || 'Could not load the practice desk.')
    return data
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await loadStatus()
        if (cancelled) return
        setStatus(data)
        if (data.lastCycle?.decisions) setCycle(data.lastCycle)
        if (data.fills) setFills(data.fills)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the practice desk.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!running) return
    let i = 0
    setPhase(STAGES[0])
    const id = window.setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1)
      setPhase(STAGES[i])
    }, 4500)
    return () => window.clearInterval(id)
  }, [running])

  const runCycle = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/tradebot/cycle', { method: 'POST', credentials: 'include' })
      const data = await parseJsonResponse<CycleView & { error?: string; userMessage?: string }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Could not check the market.')
      setCycle(data)
      setPhase('done')
      const next = await loadStatus()
      setStatus(next)
      if (next.fills) setFills(next.fills)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the market.')
      setPhase('idle')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- one stale-cycle kick; runCycle is guarded by runningRef
  useEffect(() => {
    if (!status?.paper || loading) return
    const last = status.lastCycle?.ranAt
    const age = last ? Date.now() - Date.parse(last) : Number.POSITIVE_INFINITY
    const maxAge = (status.cycleMinutes || 60) * 60_000
    if (!(age >= maxAge)) return
    const t = window.setTimeout(() => {
      void runCycle()
    }, 1500)
    return () => window.clearTimeout(t)
  }, [status?.paper, loading])

  const agent = AGENTS.find((a) => a.id === selected) || AGENTS[4]
  const ledger = cycle?.ledger || status?.ledger
  const equity = cycle?.equity ?? status?.equity
  const cash = cycle?.cash ?? ledger?.cash
  const paperReady = Boolean(status?.paper)
  const startCad = status?.startingCad || 100
  const goalMin = status?.dailyProfitTargetMinPct || 8
  const goalMax = status?.dailyProfitTargetMaxPct || 10
  const dayPnl = cycle?.dayPnlPct ?? status?.dayPnlPct
  const quote = status?.quoteProbe
  const cryptoQuote = status?.cryptoProbe
  const universe = cycle?.scan?.universe || status?.universe?.universe || 0
  const newListings = cycle?.scan?.newListings ?? status?.universe?.newListings ?? 0
  const cryptoPairs = cycle?.scan?.cryptoPairs || 0
  const stageIndex = running ? STAGES.indexOf(phase as (typeof STAGES)[number]) : phase === 'done' ? STAGES.length : -1

  const inspectorTask = useMemo(() => {
    if (running) return `${agent.name} is working now.`
    if (!cycle?.decisions?.length) return agent.idle
    if (agent.id === 'sentinel') {
      const blocked = cycle.decisions.filter((d) => !d.fill?.filled && d.proposal.action !== 'HOLD')
      return blocked.length
        ? `Safety blocked ${blocked.length} trade(s).`
        : 'Safety is OK. Practice trades were saved.'
    }
    if (agent.id === 'archive') {
      const news = cycle.scan?.newsItems || 0
      return news ? `Read ${news} news stories.` : 'No news this round.'
    }
    if (agent.id === 'scout') {
      const hot = cycle.scan?.highPotential?.map(coinName).join(', ')
      return hot ? `Coins that look hot: ${hot}` : agent.idle
    }
    if (agent.id === 'helm') {
      const acts = cycle.decisions.map((d) => `${coinName(d.ticker)} ${actionWord(d.proposal.action)}`).join(', ')
      return acts || agent.idle
    }
    const first = cycle.decisions[0]
    return first?.proposal.reasoning_summary || agent.idle
  }, [agent, cycle, running])

  const feed = useMemo(() => {
    if (!cycle?.decisions?.length) {
      return [{ who: 'NEWS', color: '#be91ff', text: 'Press Check market to look for coins. This uses fake money, not real money.', at: '' }]
    }
    const items = cycle.decisions.map((d) => ({
      who: coinName(d.ticker),
      color: d.fill?.filled ? '#9ddd55' : d.proposal.action === 'HOLD' ? '#58a9e8' : '#d6a56e',
      text: d.fill?.filled
        ? `${actionWord(d.fill.side)} at ${cad(d.fill.price)}`
        : d.proposal.action === 'HOLD'
          ? 'Did not buy or sell.'
          : plainNote(d.fill?.note || d.proposal.reasoning_summary || actionWord(d.proposal.action)),
      at: cycle.ranAt,
    }))
    if (cycle.scan) {
      items.unshift({
        who: 'NEWS',
        color: '#be91ff',
        text: cycle.scan.newsItems
          ? `Read ${cycle.scan.newsItems} news stories.`
          : 'No news this round.',
        at: cycle.ranAt,
      })
      items.unshift({
        who: 'FINDER',
        color: '#9ddd55',
        text: `Looked at ${cycle.scan.universe || cycle.scan.shortlist.length} coins. Hot ones: ${(cycle.scan.highPotential || []).map(coinName).join(', ') || 'none yet'}.`,
        at: cycle.ranAt,
      })
    }
    return items
  }, [cycle])

  return (
    <div className="tradebot-floor">
      <div className="tb-scan" aria-hidden />
      <header className="tb-topbar">
        <div className="tb-brand">
          <span className="tb-mark" aria-hidden />
          <span>
            <small>Practice money · Canada</small>
            <strong>TRADEBOT</strong>
          </span>
        </div>
        <div className={`tb-connect ${paperReady ? 'ok' : ''}`}>
          <span className="tb-dot" />
          <span>
            <b>{paperReady ? 'Ready to practice' : 'Practice is off'}</b>
            <small>{loading ? 'Loading…' : 'Fake money only · no real trades'}</small>
          </span>
        </div>
        <div className="tb-link" style={{ background: 'linear-gradient(135deg, #5da5d82b, #5da5d80a)', boxShadow: 'inset 0 2px #5da5d8, inset 0 -1px #5da5d840' }}>
          <small>Money type</small>
          <b>Canadian dollars</b>
        </div>
      </header>

      {error ? <p className="tb-err">{error}</p> : null}

      <section className="tb-tickers">
        <div className="tb-ticker">
          <small>Your fake money · started with {cad(startCad)}</small>
          <b>{typeof equity === 'number' ? cad(equity) : '—'}</b>
          <em>
            Cash left {typeof cash === 'number' ? cad(cash) : '—'} · today{' '}
            {typeof dayPnl === 'number'
              ? `${dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(1)}%`
              : '—'}{' '}
            · goal +{goalMin}–{goalMax}%
          </em>
        </div>
        <div className="tb-ticker">
          <small>Coins checked</small>
          <b>{universe ? universe.toLocaleString('en-CA') : '—'}</b>
          <em>{newListings} new · {cryptoPairs || (cryptoQuote?.ok ? 'crypto on' : 'waiting')}</em>
        </div>
        <div className="tb-ticker">
          <small>Bitcoin price (check)</small>
          <b>
            {cryptoQuote?.ok
              ? coinName(cryptoQuote.symbol)
              : quote?.ok
                ? coinName(quote.symbol)
                : 'No price yet'}
          </b>
          <em>
            {cryptoQuote?.ok
              ? cad(cryptoQuote.price || 0)
              : quote?.ok
                ? cad(quote.price || 0)
                : quote?.error || cryptoQuote?.error || 'Loading…'}
          </em>
        </div>
      </section>

      <div className="tb-workspace">
        <aside className="tb-rail tb-left">
          <section className="tb-panel">
            <header className="tb-heading">
              <span>What this is</span>
              <b>{paperReady ? 'On' : 'Off'}</b>
            </header>
            <div className="tb-body">
              <p>{description}</p>
              <p style={{ marginTop: 8 }}>
                Always watches {TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV.split(',').map((s) => coinName(s.trim())).join(', ')}.
              </p>
            </div>
            <div className="tb-kpi">
              <span>Coins looked at <b>{universe || '—'}</b></span>
              <span>Trades done <b>{fills.length}</b></span>
            </div>
          </section>
          <section className="tb-health">
            <span>
              <i className="tb-dot" style={{ width: 7, height: 7 }} />
              {paperReady ? 'Fake money is on' : 'Turn on practice in settings'}
            </span>
            <b>You can look and run</b>
            <p className="tb-muted" style={{ marginTop: 6 }}>
              The AI suggests. The computer records fake buys and sells. Nothing real is bought.
            </p>
          </section>
          {ledger && ledger.positions.length > 0 ? (
            <section className="tb-panel">
              <header className="tb-heading">
                <span>Coins you hold</span>
                <b>{ledger.positions.length}</b>
              </header>
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>How many</th>
                    <th>Avg price</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.positions.map((p) => (
                    <tr key={p.symbol}>
                      <td>{coinName(p.symbol)}</td>
                      <td>{p.qty}</td>
                      <td>{cad(p.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </aside>

        <section className="tb-ops">
          <header className="tb-mission">
            <div>
              <small>{running ? 'Checking the market…' : 'Practice desk · Canada'}</small>
              <h2>The floor</h2>
              <p className="tb-muted">
                Start with {cad(startCad)} fake money. Hunt coins. Sell winners around +20%. Aim for +{goalMin}–{goalMax}% today.
              </p>
            </div>
            <button type="button" className="tb-run" onClick={runCycle} disabled={running || !paperReady}>
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {running ? 'Checking…' : 'Check market'}
            </button>
          </header>

          <div className="tb-stages">
            {AGENTS.map((a, i) => (
              <span key={a.id} className={stageIndex === i ? 'on' : stageIndex > i ? 'done' : ''}>
                {i > 0 ? <i /> : null}
                {a.name}
              </span>
            ))}
          </div>

          <div className="tb-room">
            <div className="tb-plane" aria-hidden />
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Show ${a.name}`}
                className={`tb-desk${selected === a.id ? ' sel' : ''}${phase === a.id ? ' work' : ''}`}
                style={{ ['--agent' as string]: a.color, left: a.x, top: a.y }}
                onClick={() => setSelected(a.id)}
              >
                <span className="tb-screen" />
                <span className="tb-bot" />
                <b>{a.name}</b>
                <small>{a.role}</small>
              </button>
            ))}
            <div className="tb-inspect" style={{ ['--agent' as string]: agent.color }}>
              <span className="tb-bot" />
              <div>
                <small>You picked</small>
                <b>{agent.name}</b>
                <em>{agent.role}</em>
                <p>{inspectorTask}</p>
              </div>
            </div>
            <div className="tb-legend">
              <span><i className="w" />Busy</span>
              <span><i className="h" />Done</span>
              <span><i className="r" />Waiting</span>
            </div>
          </div>

          {cycle?.halted ? <p className="tb-err">{plainNote(cycle.haltReason)}</p> : null}
          {cycle?.profitLocked || status?.profitLocked ? (
            <p className="tb-muted" style={{ marginTop: 8 }}>
              We already hit today’s +{goalMax}% goal. No new buys until tomorrow.
            </p>
          ) : null}
        </section>

        <aside className="tb-rail tb-right">
          <section className="tb-panel">
            <header className="tb-heading">
              <span>Helpers</span>
              <b>6</b>
            </header>
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`tb-row${selected === a.id ? ' sel' : ''}${phase === a.id ? ' work' : ''}`}
                style={{ ['--agent' as string]: a.color }}
                onClick={() => setSelected(a.id)}
              >
                <span className="tb-bot" style={{ ['--agent' as string]: a.color, width: 26, height: 22 }} />
                <span>
                  <b>{a.name}</b>
                  <small>{a.role}</small>
                </span>
                <i className="tb-state" />
              </button>
            ))}
          </section>

          <section className="tb-panel" style={{ flex: 1 }}>
            <header className="tb-heading">
              <span>What just happened</span>
              <b>{running ? 'Working' : cycle ? 'Last check' : 'Waiting'}</b>
            </header>
            <div className="tb-feed">
              {feed.map((item, i) => (
                <article key={`${item.who}-${i}`} className="tb-item" style={{ ['--agent' as string]: item.color }}>
                  <header>
                    <b>{item.who}</b>
                    {item.at ? <time>{new Date(item.at).toLocaleTimeString()}</time> : null}
                  </header>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {fills.length > 0 ? (
        <section className="tb-panel" style={{ margin: 10, position: 'relative', zIndex: 2 }}>
          <header className="tb-heading">
            <span>Fake trades</span>
            <b>Practice log</b>
          </header>
          <table className="tb-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Buy or sell</th>
                <th>Coin</th>
                <th>How many</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {fills.slice(0, 8).map((f) => (
                <tr key={`${f.at}-${f.symbol}-${f.side}`}>
                  <td>{f.at ? new Date(f.at).toLocaleString() : '—'}</td>
                  <td>{actionWord(f.side)}</td>
                  <td>{coinName(f.symbol)}</td>
                  <td>{f.qty}</td>
                  <td>{cad(f.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="tb-dev" style={{ position: 'relative', zIndex: 2 }}>
        <b>Note</b> — You start with {cad(startCad)} fake money. Daily goal is +{goalMin}–{goalMax}%. Practice must be turned on.
        <button type="button" className="tb-copy" style={{ marginLeft: 10 }} onClick={() => setShowVars((v) => !v)}>
          {showVars ? 'Hide settings' : 'Show settings'}
        </button>
        {showVars ? (
          <>
            <button
              type="button"
              className="tb-copy"
              style={{ marginLeft: 8 }}
              onClick={() => {
                navigator.clipboard.writeText(ENV_SNIPPET)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre>{ENV_SNIPPET}</pre>
          </>
        ) : null}
      </div>
    </div>
  )
}
