'use client'

import { useEffect, useMemo, useState } from 'react'
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
  ledger: { cash: number; positions: Position[]; halted?: boolean; haltReason?: string }
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
  ledger?: { cash: number; positions: Position[]; halted?: boolean; haltReason?: string } | null
  fills?: FillRow[]
  lastCycle?: CycleView | null
  error?: string
  userMessage?: string
}

const ENV_SNIPPET = `TRADEBOT_PAPER=true
TRADEBOT_GEMINI_MODEL=gemini-2.5-flash
TRADEBOT_MAX_DRAWDOWN_PCT=5
TRADEBOT_MAX_ASSET_WEIGHT=15
TRADEBOT_RISK_PCT=1
TRADEBOT_STARTING_CAD=100
TRADEBOT_CRYPTO_ONLY=true
TRADEBOT_CRYPTO=true
TRADEBOT_CRYPTO_WATCHLIST=${TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV}
TRADEBOT_SHORTLIST_CRYPTO=12
TRADEBOT_CYCLE_MINUTES=60
COINGECKO_DEMO_API_KEY=`

const AGENTS = [
  { id: 'scout', name: 'SCOUT', role: 'Market monitor', color: '#9ddd55', idle: 'Hunting new coins and memes.', x: '18%', y: '28%' },
  { id: 'archive', name: 'ARCHIVE', role: 'News desk', color: '#be91ff', idle: 'Cross-checking headlines and industry tape.', x: '50%', y: '22%' },
  { id: 'forge', name: 'FORGE', role: 'Bull desk', color: '#42cbbb', idle: 'Building the long thesis.', x: '82%', y: '28%' },
  { id: 'relay', name: 'RELAY', role: 'Bear desk', color: '#58a9e8', idle: 'Arguing the counter-risk.', x: '22%', y: '68%' },
  { id: 'helm', name: 'HELM', role: 'Trader', color: '#ff6557', idle: 'Issuing BUY / SELL / HOLD.', x: '50%', y: '74%' },
  { id: 'sentinel', name: 'SENTINEL', role: 'Guardrails', color: '#d6a56e', idle: '15% cap · stop · 5% halt.', x: '78%', y: '68%' },
] as const

const STAGES = AGENTS.map((a) => a.id)

function cad(n: number): string {
  return `CA$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const loadStatus = async () => {
    const res = await fetch('/api/tradebot/status', { credentials: 'include' })
    const data = await parseJsonResponse<StatusResponse>(res)
    if (!res.ok) throw new Error(data.error || 'Could not load TradeBot status.')
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load TradeBot status.')
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
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/tradebot/cycle', { method: 'POST', credentials: 'include' })
      const data = await parseJsonResponse<CycleView & { error?: string; userMessage?: string }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Paper cycle failed.')
      setCycle(data)
      setPhase('done')
      const next = await loadStatus()
      setStatus(next)
      if (next.fills) setFills(next.fills)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paper cycle failed.')
      setPhase('idle')
    } finally {
      setRunning(false)
    }
  }

  const agent = AGENTS.find((a) => a.id === selected) || AGENTS[4]
  const ledger = cycle?.ledger || status?.ledger
  const equity = cycle?.equity ?? status?.equity
  const cash = cycle?.cash ?? ledger?.cash
  const paperReady = Boolean(status?.paper)
  const quote = status?.quoteProbe
  const cryptoQuote = status?.cryptoProbe
  const universe = cycle?.scan?.universe || status?.universe?.universe || 0
  const newListings = cycle?.scan?.newListings ?? status?.universe?.newListings ?? 0
  const cryptoPairs = cycle?.scan?.cryptoPairs || 0
  const stageIndex = running ? STAGES.indexOf(phase as (typeof STAGES)[number]) : phase === 'done' ? STAGES.length : -1

  const inspectorTask = useMemo(() => {
    if (running) return `${agent.name} is on the cycle.`
    if (!cycle?.decisions?.length) return agent.idle
    if (agent.id === 'sentinel') {
      const blocked = cycle.decisions.filter((d) => !d.fill?.filled && d.proposal.action !== 'HOLD')
      return blocked.length
        ? `Blocked ${blocked.length} proposal(s) on hard rules.`
        : 'Guardrails clear. Paper fills recorded.'
    }
    if (agent.id === 'archive') {
      const tape = cycle.scan?.industryTape?.slice(0, 2).join(' · ')
      const news = cycle.scan?.newsItems || 0
      return tape ? `${news} headlines. ${tape}` : `${news} headlines on the shortlist.`
    }
    if (agent.id === 'scout') {
      const hot = cycle.scan?.highPotential?.join(' · ')
      return hot ? `High potential: ${hot}` : agent.idle
    }
    if (agent.id === 'helm') {
      const acts = cycle.decisions.map((d) => `${d.ticker} ${d.proposal.action}`).join(' · ')
      return acts || agent.idle
    }
    const first = cycle.decisions[0]
    return first?.proposal.reasoning_summary || agent.idle
  }, [agent, cycle, running])

  const feed = useMemo(() => {
    if (!cycle?.decisions?.length) {
      return [{ who: 'ARCHIVE', color: '#be91ff', text: 'Waiting for a cycle. Will hunt new coins, memes, and cross-check rugs vs squeeze news.', at: '' }]
    }
    const items = cycle.decisions.map((d) => ({
      who: `${d.ticker}`,
      color: d.fill?.filled ? '#9ddd55' : d.proposal.action === 'HOLD' ? '#58a9e8' : '#d6a56e',
      text: d.fill?.note || d.proposal.reasoning_summary || `${d.proposal.action} ${d.signal}`,
      at: cycle.ranAt,
    }))
    if (cycle.scan) {
      items.unshift({
        who: 'ARCHIVE',
        color: '#be91ff',
        text: `${cycle.scan.newsItems || 0} headlines · tape: ${(cycle.scan.industryTape || []).slice(0, 2).join(' · ') || 'quiet'}`,
        at: cycle.ranAt,
      })
      items.unshift({
        who: 'SCOUT',
        color: '#9ddd55',
        text: `Universe ${cycle.scan.universe} · new ${cycle.scan.newListings} · high potential ${(cycle.scan.highPotential || []).join(' · ') || 'none'} · shortlist ${cycle.scan.shortlist.join(' · ') || 'none'}`,
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
            <small>CAD CRYPTO PAPER DESK</small>
            <strong>TRADEBOT FLOOR</strong>
          </span>
        </div>
        <div className={`tb-connect ${paperReady ? 'ok' : ''}`}>
          <span className="tb-dot" />
          <span>
            <b>{paperReady ? 'PAPER RUNTIME ONLINE' : 'PAPER FLAG OFF'}</b>
            <small>{loading ? 'SYNCING LEDGER' : 'KRAKEN · COINGECKO · CAD'}</small>
          </span>
        </div>
        <div className="tb-link" style={{ background: 'linear-gradient(135deg, #5da5d82b, #5da5d80a)', boxShadow: 'inset 0 2px #5da5d8, inset 0 -1px #5da5d840' }}>
          <small>REGION / BOOKS</small>
          <b>CA · CAD</b>
        </div>
      </header>

      {error ? <p className="tb-err">{error}</p> : null}

      <section className="tb-tickers">
        <div className="tb-ticker">
          <small>TRADING AGENT / PAPER PNL</small>
          <b>{typeof equity === 'number' ? cad(equity) : '—'}</b>
          <em>CASH {typeof cash === 'number' ? cad(cash) : '—'} · START CA$100</em>
        </div>
        <div className="tb-ticker">
          <small>CRYPTO HUNT / NEW + MEMES</small>
          <b>{universe ? universe.toLocaleString('en-CA') : '—'}</b>
          <em>NEW {String(newListings).padStart(2, '0')} · CRYPTO {cryptoPairs || (cryptoQuote?.ok ? 'ON' : '—')}</em>
        </div>
        <div className="tb-ticker">
          <small>LIVE PRINTS</small>
          <b>
            {cryptoQuote?.ok ? cryptoQuote.symbol : quote?.ok ? quote.symbol : 'PRICE UNAVAILABLE'}
          </b>
          <em>
            {cryptoQuote?.ok
              ? `${cad(cryptoQuote.price || 0)} · ${cryptoQuote.source || 'kraken'}`
              : quote?.ok
                ? `${cad(quote.price || 0)} · ${quote.source}`
                : quote?.error || cryptoQuote?.error || 'FETCHING'}
          </em>
        </div>
      </section>

      <div className="tb-workspace">
        <aside className="tb-rail tb-left">
          <section className="tb-panel">
            <header className="tb-heading">
              <span>MISSION SOURCE</span>
              <b>{paperReady ? 'ACTIVE' : 'HALTED'}</b>
            </header>
            <div className="tb-body">
              <p>{description}</p>
              <p style={{ marginTop: 8 }}>
                Seeds {TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV.replace(/,/g, ' · ')} · CoinGecko hunt on
              </p>
            </div>
            <div className="tb-kpi">
              <span>UNIVERSE <b>{universe ? String(universe).padStart(2, '0') : '—'}</b></span>
              <span>FILLS <b>{String(fills.length).padStart(2, '0')}</b></span>
            </div>
          </section>
          <section className="tb-health">
            <span>
              <i className="tb-dot" style={{ width: 7, height: 7 }} />
              {paperReady ? 'PRIVATE PAPER RUNTIME' : 'AWAITING TRADEBOT_PAPER'}
            </span>
            <b>READ / RUN OWNER VIEW</b>
            <p className="tb-muted" style={{ marginTop: 6 }}>
              Gemini debates. TypeScript fills. LLMs never call a broker.
            </p>
          </section>
          {ledger && ledger.positions.length > 0 ? (
            <section className="tb-panel">
              <header className="tb-heading">
                <span>OPEN BOOK</span>
                <b>{ledger.positions.length} POS</b>
              </header>
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>SYM</th>
                    <th>QTY</th>
                    <th>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.positions.map((p) => (
                    <tr key={p.symbol}>
                      <td>{p.symbol}</td>
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
              <small>DECK 07 · CANADA STATION · {running ? 'CYCLE' : 'NETWORK ACTIVE'}</small>
              <h2>Operations Floor</h2>
              <p className="tb-muted">SCOUT hunts new coins and memes for short-term CAD paper pops. ARCHIVE blocks rugs. HELM scales out fast.</p>
            </div>
            <button type="button" className="tb-run" onClick={runCycle} disabled={running || !paperReady}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {running ? 'RUNNING' : 'RUN CYCLE'}
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
                aria-label={`Inspect ${a.name}`}
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
                <small>SELECTED AGENT</small>
                <b>{agent.name}</b>
                <em>{agent.role}</em>
                <p>{inspectorTask}</p>
              </div>
            </div>
            <div className="tb-legend">
              <span><i className="w" />WORKING</span>
              <span><i className="h" />LIVE HANDOFF</span>
              <span><i className="r" />REVIEW</span>
            </div>
          </div>

          {cycle?.halted ? <p className="tb-err">{cycle.haltReason}</p> : null}
        </section>

        <aside className="tb-rail tb-right">
          <section className="tb-panel">
            <header className="tb-heading">
              <span>AGENT COUNCIL</span>
              <b>06 ONLINE</b>
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
              <span>LIVE AGENT HANDOFFS</span>
              <b>{running ? 'STREAMING' : cycle ? 'LAST CYCLE' : 'IDLE'}</b>
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
            <span>PAPER FILLS</span>
            <b>CAD LEDGER</b>
          </header>
          <table className="tb-table">
            <thead>
              <tr>
                <th>WHEN</th>
                <th>SIDE</th>
                <th>SYM</th>
                <th>QTY</th>
                <th>PX</th>
              </tr>
            </thead>
            <tbody>
              {fills.slice(0, 8).map((f) => (
                <tr key={`${f.at}-${f.symbol}-${f.side}`}>
                  <td>{f.at ? new Date(f.at).toLocaleString() : '—'}</td>
                  <td>{f.side}</td>
                  <td>{f.symbol}</td>
                  <td>{f.qty}</td>
                  <td>{cad(f.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="tb-dev" style={{ position: 'relative', zIndex: 2 }}>
        <b>OPERATOR NOTE</b> — Paper CAD crypto only. Hunts new coins and memes. Set TRADEBOT_PAPER=true.
        <button type="button" className="tb-copy" style={{ marginLeft: 10 }} onClick={() => setShowVars((v) => !v)}>
          {showVars ? 'HIDE ENV' : 'SHOW ENV'}
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
              {copied ? 'COPIED' : 'COPY'}
            </button>
            <pre>{ENV_SNIPPET}</pre>
          </>
        ) : null}
      </div>
    </div>
  )
}
