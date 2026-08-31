'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import { TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV } from '@/lib/tradebot/canada'
import type { TradebotProviderStatus } from '@/lib/tradebot/envCatalog'
import { featuredLiveMark } from '@/lib/tradebot/liveTapeRank'
import { LIVE_LEDGER_ID, PAPER_LEDGER_ID } from '@/lib/tradebot/deskBooks'
import { parseVolatility, volatilityProfile, type VolatilityLevel } from '@/lib/tradebot/volatility'
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
  ledger: { id?: string; cash: number; positions: Position[]; halted?: boolean; haltReason?: string; dayStartEquity?: number; startingEquity?: number; liveMode?: boolean; engineOn?: boolean }
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
  ledger?: {
    id?: string
    cash: number
    positions: Position[]
    openOrders?: Array<{
      txid: string
      symbol: string
      side: 'BUY' | 'SELL'
      kind: 'entry' | 'stop' | 'take'
      qty: number
      price: number
      placedAt: string
    }>
    halted?: boolean
    haltReason?: string
    dayStartEquity?: number
    startingEquity?: number
    liveMode?: boolean
    engineOn?: boolean
  } | null
  fills?: FillRow[]
  lastCycle?: CycleView | null
  startingCad?: number
  dailyProfitTargetMinPct?: number
  dailyProfitTargetMaxPct?: number
  cycleMinutes?: number
  tickSeconds?: number
  liveWatch?: boolean
  engineOn?: boolean
  liveMode?: boolean
  liveAllowed?: boolean
  krakenLive?: boolean
  krakenConfigured?: boolean
  krakenSyncError?: string
  volatility?: VolatilityLevel
  stopPct?: number
  takePct?: number
  maxDrawdownPct?: number
  dayPnlPct?: number
  profitLocked?: boolean
  huntNote?: string
  error?: string
  userMessage?: string
}

const ENV_SNIPPET = `GEMINI_API=
MONGODB_URI=
TRADEBOT_PAPER=true
TRADEBOT_LIVE=true
TRADEBOT_KRAKEN_ONLY=true
TRADEBOT_CRYPTO_ONLY=true
TRADEBOT_STOP_PCT=2
TRADEBOT_TAKE_PCT=9
TRADEBOT_MAX_ASSET_WEIGHT=75
TRADEBOT_MAX_DRAWDOWN_PCT=8
TRADEBOT_STARTING_CAD=100
TRADEBOT_TICK_SECONDS=8
TRADEBOT_MAX_OPEN=1
TRADEBOT_KRAKEN_FEE_BPS=80
TRADEBOT_KRAKEN_MAKER_BPS=40
TRADEBOT_CRYPTO_WATCHLIST=${TRADEBOT_DEFAULT_CRYPTO_WATCHLIST_CSV}
KRAKEN_API_KEY=
KRAKEN_API_SECRET=`

const AGENTS = [
  { id: 'scout', name: 'FINDER', role: 'Looks for coins', idle: 'Hourly trend up, then a 15m reversal off the swing low.', color: '#9ddd55', x: '18%', y: '28%' },
  { id: 'archive', name: 'NEWS', role: 'Reads the news', idle: 'Checking the news for scams.', color: '#be91ff', x: '50%', y: '22%' },
  { id: 'forge', name: 'YES', role: 'Why we might buy', idle: 'Looking for good reasons to buy.', color: '#42cbbb', x: '82%', y: '28%' },
  { id: 'relay', name: 'NO', role: 'Why we might wait', idle: 'Looking for reasons not to buy.', color: '#58a9e8', x: '22%', y: '68%' },
  { id: 'helm', name: 'TRADER', role: 'Buys and sells', idle: 'Watching live prices. Buys and sells when the desk is ON.', color: '#ff6557', x: '50%', y: '74%' },
  { id: 'sentinel', name: 'SAFETY', role: 'Stops big losses', idle: 'Maker buys. One swing ticket, most of the book. Take ~8–12% so fees are a minority. Trails only after half the take is in. Day halt -8%.', color: '#d6a56e', x: '78%', y: '68%' },
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

function openOrderLabel(kind: string, side: string): string {
  if (kind === 'entry') return side === 'SELL' ? 'Maker sell' : 'Maker buy'
  if (kind === 'stop') return 'Stop'
  if (kind === 'take') return 'Take'
  return kind
}

function plainNote(text: string): string {
  const t = text || ''
  if (/Paper CAD fill/i.test(t)) return t.replace(/Paper CAD fill · /i, 'Fee ')
  if (/HOLD — no order/i.test(t) || /HOLD - no order/i.test(t)) return 'Did not buy or sell.'
  if (/Blocked by guardrails/i.test(t)) return 'Safety said no.'
  if (/drawdown/i.test(t)) return 'Stopped for today: the book dropped about 8%.'
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
  const [showVars, setShowVars] = useState(true)
  const [watching, setWatching] = useState(false)
  const [engineBusy, setEngineBusy] = useState(false)
  const [marks, setMarks] = useState<Array<{ symbol: string; price: number; dayChangePct: number }>>([])
  const runningRef = useRef(false)
  const tickRef = useRef(false)
  const liveModeRef = useRef(false)

  const loadStatus = async () => {
    const res = await fetch('/api/tradebot/status', { credentials: 'include', cache: 'no-store' })
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
        liveModeRef.current = Boolean(data.liveMode)
        if (data.krakenSyncError) setError(data.krakenSyncError)
        if (data.lastCycle?.decisions) setCycle(data.lastCycle)
        else if (data.liveMode) setCycle(null)
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
      const data = await parseJsonResponse<CycleView & { error?: string; userMessage?: string; skipped?: boolean }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Could not check the market.')
      if (data.skipped) throw new Error(data.userMessage || 'Turn the system ON first.')
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

  const runTick = async () => {
    if (runningRef.current || tickRef.current) return
    tickRef.current = true
    try {
      const res = await fetch('/api/tradebot/tick', { method: 'POST', credentials: 'include', cache: 'no-store' })
      const data = await parseJsonResponse<
        CycleView & {
          live?: boolean
          krakenLive?: boolean
          engineOn?: boolean
          huntNote?: string
          marks?: Array<{ symbol: string; price: number; dayChangePct: number }>
          fills?: FillRow[]
          error?: string
          userMessage?: string
        }
      >(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Could not watch prices.')
      setWatching(true)
      if (data.marks?.length) setMarks(data.marks)
      const tickBook = data.ledger?.id
      const skipFakeOntoReal =
        liveModeRef.current && (tickBook === PAPER_LEDGER_ID || data.ledger?.liveMode === false)
      const skipLiveOntoFake = !liveModeRef.current && tickBook === LIVE_LEDGER_ID
      if (!skipFakeOntoReal && !skipLiveOntoFake) {
        liveModeRef.current = Boolean(data.ledger?.liveMode ?? liveModeRef.current)
      }
      setStatus((prev) => {
        if (!prev) return prev
        if (skipFakeOntoReal || skipLiveOntoFake) return prev
        return {
          ...prev,
          equity: data.equity,
          ledger: data.ledger,
          dayPnlPct: data.dayPnlPct,
          profitLocked: data.profitLocked,
          engineOn: data.engineOn ?? prev.engineOn,
          liveMode: data.ledger?.liveMode ?? prev.liveMode,
          krakenLive: typeof data.krakenLive === 'boolean' ? data.krakenLive : prev.krakenLive,
          paper: typeof data.krakenLive === 'boolean' ? !data.krakenLive : prev.paper,
          paperOnly: typeof data.krakenLive === 'boolean' ? !data.krakenLive : prev.paperOnly,
          huntNote: data.huntNote ?? prev.huntNote,
        }
      })
      if (data.fills && !skipFakeOntoReal && !skipLiveOntoFake) setFills(data.fills)
      const acted = (data.decisions || []).filter((d) => d.fill)
      if (acted.length && !skipFakeOntoReal && !skipLiveOntoFake) {
        setCycle((prev) => ({
          ranAt: data.ranAt,
          halted: data.halted,
          haltReason: data.haltReason,
          equity: data.equity,
          cash: data.cash,
          drawdownPct: data.drawdownPct,
          dayPnlPct: data.dayPnlPct,
          profitLocked: data.profitLocked,
          dayStartEquity: data.dayStartEquity,
          ledger: data.ledger,
          decisions: [...acted, ...(prev?.decisions || [])].slice(0, 24),
          scan: prev?.scan || data.scan,
        }))
      }
    } catch {
      /* keep last prices on a failed tick */
    } finally {
      tickRef.current = false
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- live prices while this tab is open
  useEffect(() => {
    if (loading || (!status?.paper && !status?.krakenConfigured && !status?.engineReady && !status?.liveAllowed)) return
    const ms = Math.max(5000, (status?.tickSeconds || 8) * 1000)
    void runTick()
    const id = window.setInterval(() => {
      void runTick()
    }, ms)
    return () => window.clearInterval(id)
  }, [status?.paper, status?.krakenConfigured, status?.tickSeconds, status?.engineReady, status?.liveAllowed, loading])

  const setEngine = async (on: boolean) => {
    if (engineBusy || (!status?.paper && !status?.krakenConfigured && !status?.liveAllowed)) return
    setEngineBusy(true)
    setError('')
    if (!on) setWatching(false)
    try {
      const res = await fetch('/api/tradebot/engine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on }),
      })
      const data = await parseJsonResponse<{
        engineOn?: boolean
        liveMode?: boolean
        krakenLive?: boolean
        ledger?: StatusResponse['ledger']
        error?: string
      }>(res)
      if (!res.ok) throw new Error(data.error || 'Could not change ON/OFF.')
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              engineOn: Boolean(data.engineOn),
              liveMode: Boolean(data.liveMode),
              krakenLive: Boolean(data.krakenLive),
              ledger: data.ledger || prev.ledger,
            }
          : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change ON/OFF.')
    } finally {
      setEngineBusy(false)
    }
  }

  const setMoneyMode = async (live: boolean) => {
    if (engineBusy) return
    if (live && !status?.liveAllowed) {
      setError('Set TRADEBOT_LIVE=true and Kraken API keys, then redeploy, to unlock Real money.')
      return
    }
    if (live && !window.confirm('Switch to REAL Kraken money? Press ON after this to place real CAD orders. Fake never talks to Kraken.')) {
      return
    }
    setEngineBusy(true)
    setError('')
    try {
      const res = await fetch('/api/tradebot/engine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveMode: live }),
        cache: 'no-store',
      })
      const data = await parseJsonResponse<{
        engineOn?: boolean
        liveMode?: boolean
        krakenLive?: boolean
        ledger?: StatusResponse['ledger']
        error?: string
      }>(res)
      if (!res.ok) throw new Error(data.error || 'Could not switch Fake/Real.')
      if (data.error) setError(data.error)
      const next = await loadStatus()
      liveModeRef.current = Boolean(next.liveMode)
      setStatus(next)
      if (next.fills) setFills(next.fills)
      if (next.krakenSyncError) setError(next.krakenSyncError)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch Fake/Real.')
    } finally {
      setEngineBusy(false)
    }
  }

  const setVolatility = async (level: VolatilityLevel) => {
    if (engineBusy) return
    setEngineBusy(true)
    setError('')
    try {
      const res = await fetch('/api/tradebot/engine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volatility: level }),
      })
      const data = await parseJsonResponse<{
        volatility?: VolatilityLevel
        engineOn?: boolean
        liveMode?: boolean
        krakenLive?: boolean
        ledger?: StatusResponse['ledger']
        error?: string
      }>(res)
      if (!res.ok) throw new Error(data.error || 'Could not change volatility.')
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              volatility: parseVolatility(data.volatility),
              engineOn: data.engineOn ?? prev.engineOn,
              liveMode: data.liveMode ?? prev.liveMode,
              krakenLive: data.krakenLive ?? prev.krakenLive,
              ledger: data.ledger || prev.ledger,
            }
          : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change volatility.')
    } finally {
      setEngineBusy(false)
    }
  }

  const agent = AGENTS.find((a) => a.id === selected) || AGENTS[4]
  const liveMode = Boolean(status?.liveMode)
  const ledger = liveMode ? status?.ledger : status?.ledger || cycle?.ledger
  const equity = liveMode
    ? typeof status?.equity === 'number'
      ? status.equity
      : typeof status?.ledger?.cash === 'number'
        ? status.ledger.cash
        : undefined
    : typeof status?.equity === 'number'
      ? status.equity
      : cycle?.equity
  const cash = liveMode ? status?.ledger?.cash : status?.ledger?.cash ?? cycle?.cash ?? ledger?.cash
  const paperReady = Boolean(status?.paper || status?.krakenConfigured || status?.liveAllowed)
  const engineOn = Boolean(status?.engineOn)
  const liveAllowed = Boolean(status?.liveAllowed)
  const krakenLive = Boolean(status?.krakenLive)
  const vol = volatilityProfile(parseVolatility(status?.volatility))
  const startCad = liveMode
    ? Number(status?.ledger?.startingEquity || status?.ledger?.cash || 0)
    : status?.startingCad || 100
  const goalMin = status?.dailyProfitTargetMinPct || 8
  const goalMax = status?.dailyProfitTargetMaxPct || 200
  const dayPnl = status?.dayPnlPct ?? cycle?.dayPnlPct
  const quote = status?.quoteProbe
  const cryptoQuote = status?.cryptoProbe
  const heldSymbols = (ledger?.positions || []).map((p) => p.symbol)
  const openOrders = ledger?.openOrders || []
  const huntNote = status?.huntNote || ''
  const hotMark = featuredLiveMark(marks, heldSymbols)
  const markOf = (symbol: string) => marks.find((m) => m.symbol === symbol)
  const universe = cycle?.scan?.universe || status?.universe?.universe || 0
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
      return [
        {
          who: 'TRADER',
          color: '#ff6557',
          text: status?.huntNote || (engineOn ? 'Watching live prices. Buys a dip when the hourly trend is still up.' : 'System is OFF. Live prices still update. Press ON to trade.'),
          at: '',
        },
      ]
    }
    const items = cycle.decisions.map((d) => ({
      who: coinName(d.ticker),
      color: d.fill?.filled ? '#9ddd55' : d.proposal.action === 'HOLD' ? '#58a9e8' : '#d6a56e',
      text: d.fill?.filled
        ? `${actionWord(d.fill.side)} at ${cad(d.fill.price)}. ${plainNote(d.proposal.reasoning_summary || d.fill.note)}`
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
  }, [cycle, engineOn, status?.huntNote])

  return (
    <div className="tradebot-floor">
      <div className="tb-scan" aria-hidden />
      <header className="tb-topbar">
        <div className="tb-brand">
          <span className="tb-mark" aria-hidden />
          <span>
            <small>{liveMode ? 'Kraken live · Canada' : 'Practice money · Canada'}</small>
            <strong>TRADEBOT</strong>
          </span>
        </div>
        <div className={`tb-connect ${paperReady ? 'ok' : ''}`}>
          <span className="tb-dot" />
          <span>
            <b>{paperReady ? (engineOn ? (watching ? 'Watching live prices' : 'ON') : 'OFF') : 'Desk is off'}</b>
            <small>
              {loading
                ? 'Loading…'
                : liveMode
                  ? engineOn
                    ? krakenLive
                      ? 'Real Kraken buys and sells'
                      : 'Real selected · this server cannot place Kraken orders yet'
                    : 'Real selected · press ON to trade'
                  : engineOn
                    ? 'Fake buys and sells as coins move'
                    : 'Fake selected. Live prices still update. Trades stay off until ON.'}
            </small>
          </span>
        </div>
        <div className="tb-mode" role="tablist" aria-label="Fake or real money">
          <button
            type="button"
            role="tab"
            aria-selected={!liveMode}
            className={!liveMode ? 'on' : ''}
            disabled={engineBusy || !paperReady}
            onClick={() => void setMoneyMode(false)}
          >
            Fake
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={liveMode}
            className={liveMode ? 'on live' : ''}
            disabled={engineBusy || !liveAllowed}
            title={liveAllowed ? 'Real Kraken CAD' : 'Set TRADEBOT_LIVE=true and Kraken keys to unlock'}
            onClick={() => void setMoneyMode(true)}
          >
            Real
          </button>
        </div>
        <div className="tb-mode" role="tablist" aria-label="Volatility">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <button
              key={level}
              type="button"
              role="tab"
              aria-selected={vol.level === level}
              className={vol.level === level ? (level === 'high' ? 'on hot' : 'on') : ''}
              disabled={engineBusy || !paperReady}
              title={volatilityProfile(level).hint}
              onClick={() => void setVolatility(level)}
            >
              {level === 'low' ? 'Low' : level === 'high' ? 'High' : 'Med'}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="tb-err">{error}</p> : null}

      <section className="tb-tickers">
        <div className="tb-ticker">
          <small>{liveMode ? 'Your Kraken CAD' : `Your fake money · started with ${cad(startCad)}`}</small>
          <b>{typeof equity === 'number' ? cad(equity) : '—'}</b>
          <em style={{ color: typeof dayPnl === 'number' && dayPnl < 0 ? 'var(--tb-red)' : 'var(--tb-acid)' }}>
            Cash {typeof cash === 'number' ? cad(cash) : '—'} · today{' '}
            {typeof dayPnl === 'number' ? `${dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(2)}%` : '—'}
          </em>
        </div>
        <div className="tb-ticker">
          <small>Kraken coins · {vol.label} vol</small>
          <b>{marks.length || universe || '—'}</b>
          <em>
            {vol.hint}. ~{vol.maxAssetWeightPct}% of the book · stop {(vol.stopPct * 100).toFixed(1)}% · take {(vol.takePct * 100).toFixed(1)}% · trail {(vol.trailPct * 100).toFixed(1)}% · max {vol.maxOpen} {vol.maxOpen === 1 ? 'coin' : 'coins'} · day halt {status?.maxDrawdownPct || 8}%
          </em>
        </div>
        <div className="tb-ticker">
          <small>{watching ? (hotMark ? `Live ${coinName(hotMark.symbol)}` : 'Live Kraken') : 'Bitcoin price (check)'}</small>
          <b>
            {hotMark
              ? coinName(hotMark.symbol)
              : cryptoQuote?.ok
                ? coinName(cryptoQuote.symbol)
                : quote?.ok
                  ? coinName(quote.symbol)
                  : 'No price yet'}
          </b>
          <em>
            {hotMark
              ? `${cad(hotMark.price)} · today ${hotMark.dayChangePct >= 0 ? '+' : ''}${hotMark.dayChangePct.toFixed(1)}%`
              : cryptoQuote?.ok
                ? cad(cryptoQuote.price || 0)
                : quote?.ok
                  ? cad(quote.price || 0)
                  : quote?.error || cryptoQuote?.error || 'Loading…'}
          </em>
        </div>
      </section>

      {marks.length > 0 ? (
        <div className="tb-pills" aria-label="Live Kraken prices">
          {marks.map((m) => (
            <span key={m.symbol} className={m.dayChangePct >= 0 ? 'up' : 'down'}>
              <b>{coinName(m.symbol)}</b> {cad(m.price)} {m.dayChangePct >= 0 ? '+' : ''}
              {m.dayChangePct.toFixed(1)}%
            </span>
          ))}
        </div>
      ) : null}

      <div className="tb-workspace">
        <aside className="tb-rail tb-left">
          <section className="tb-panel">
            <header className="tb-heading">
              <span>What this is</span>
              <b>{engineOn ? 'On' : 'Off'}</b>
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
              {paperReady ? (engineOn ? (watching ? 'Watching live prices' : 'System is on') : 'System is off') : 'Add TRADEBOT_PAPER or Kraken keys'}
            </span>
            <b>{engineOn ? (liveMode ? 'Real desk is ON' : 'Fake desk is ON') : liveMode ? 'Real selected · OFF — press ON to trade' : 'Fake selected · OFF'}</b>
            <p className={engineOn && !liveMode ? 'tb-muted' : 'tb-wait'} style={{ marginTop: 6 }}>
              {huntNote ||
                (engineOn
                  ? liveMode && krakenLive
                    ? 'Leave this tab open for live Kraken prices every 8s. Real CAD orders while ON.'
                    : 'Leave this tab open for live Kraken prices every 8s. Fake fills while ON.'
                  : 'Live prices still update. Press ON to allow buys and sells.')}
            </p>
          </section>
          {ledger ? (
            <section className="tb-panel">
              <header className="tb-heading">
                <span>Coins you hold</span>
                <b>{ledger.positions.length}</b>
              </header>
              {ledger.positions.length > 0 ? (
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>How many</th>
                    <th>Avg price</th>
                    <th>Now</th>
                    <th>Gain / loss</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.positions.map((p) => {
                    const now = markOf(p.symbol)
                    const pnl = now && p.avgPrice > 0 ? ((now.price - p.avgPrice) / p.avgPrice) * 100 : null
                    return (
                      <tr key={p.symbol}>
                        <td>{coinName(p.symbol)}</td>
                        <td>{p.qty}</td>
                        <td>{cad(p.avgPrice)}</td>
                        <td>{now ? cad(now.price) : '—'}</td>
                        <td style={{ color: pnl == null ? undefined : pnl >= 0 ? 'var(--tb-acid)' : 'var(--tb-red)' }}>
                          {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              ) : (
                <div className="tb-body">
                  <p>
                    {engineOn
                      ? 'None yet. Waiting for a 15m bounce off a swing low while the hourly trend is still up.'
                      : 'None yet. Switching to Real turns the desk OFF on purpose. Press ON to allow Kraken buys.'}
                  </p>
                </div>
              )}
            </section>
          ) : null}
          {openOrders.length > 0 ? (
            <section className="tb-panel">
              <header className="tb-heading">
                <span>Open on Kraken</span>
                <b>{openOrders.length}</b>
              </header>
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Coin</th>
                    <th>How many</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((o) => (
                    <tr key={o.txid}>
                      <td>{openOrderLabel(o.kind, o.side)}</td>
                      <td>{coinName(o.symbol)}</td>
                      <td>{o.qty}</td>
                      <td>{cad(o.price)}</td>
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
              <small>{running ? 'Checking the market…' : engineOn ? (watching ? 'Watching live prices' : 'System is on') : 'System is off'}</small>
              <h2>The floor</h2>
              <p className="tb-muted">
                Start with {cad(startCad)}. Kraken coins only. {vol.hint}. One swing ticket (~{vol.maxAssetWeightPct}% of the book), maker buys, take large enough that fees are a minority. Halt the day at -{status?.maxDrawdownPct || 8}%. No shorts. Fake to test, Real for Kraken. {liveMode ? 'Real orders while ON.' : 'Fake fills until you tap Real.'}
              </p>
            </div>
            <div className="tb-actions">
              <div className="tb-mode" role="tablist" aria-label="Fake or real money">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!liveMode}
                  className={!liveMode ? 'on' : ''}
                  disabled={engineBusy || !paperReady}
                  onClick={() => void setMoneyMode(false)}
                >
                  Fake
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={liveMode}
                  className={liveMode ? 'on live' : ''}
                  disabled={engineBusy || !liveAllowed}
                  title={liveAllowed ? 'Real Kraken CAD' : 'Set TRADEBOT_LIVE=true and Kraken keys to unlock'}
                  onClick={() => void setMoneyMode(true)}
                >
                  Real
                </button>
              </div>
              <div className="tb-mode" role="tablist" aria-label="Volatility">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="tab"
                    aria-selected={vol.level === level}
                    className={vol.level === level ? (level === 'high' ? 'on hot' : 'on') : ''}
                    disabled={engineBusy || !paperReady}
                    title={volatilityProfile(level).hint}
                    onClick={() => void setVolatility(level)}
                  >
                    {level === 'low' ? 'Low' : level === 'high' ? 'High' : 'Med'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`tb-power${engineOn ? ' on' : ''}`}
                onClick={() => void setEngine(!engineOn)}
                disabled={!paperReady || engineBusy}
              >
                {engineBusy ? '…' : engineOn ? 'ON' : 'OFF'}
              </button>
              <button type="button" className="tb-run" onClick={runCycle} disabled={running || !paperReady || !engineOn}>
                {running ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {running ? 'Checking…' : 'Check market'}
              </button>
              <p className="tb-cost">
                {engineOn
                  ? 'About CA$0.00 per minute to watch prices. AI hunt about CA$0.02 per hour (under CA$0.001 per minute). A full day on: about CA$0.50.'
                  : 'Cost while OFF: CA$0.00 per minute.'}
              </p>
            </div>
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
              We already hit the +{goalMax}% ceiling. No new buys until tomorrow.
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
              <b>{running ? 'Working' : engineOn ? (watching ? 'Live' : 'On') : 'Off'}</b>
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
            <span>{liveMode ? 'Kraken trades' : 'Fake trades'}</span>
            <b>{liveMode ? 'Live log' : 'Practice log'}</b>
          </header>
          <table className="tb-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Buy or sell</th>
                <th>Coin</th>
                <th>How many</th>
                <th>Price</th>
                <th>Why</th>
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
                  <td>{plainNote(f.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="tb-dev" style={{ position: 'relative', zIndex: 2 }}>
        <b>Setup</b>
        <ol className="tb-setup">
          <li>Fake: tap Fake, press ON, leave this tab open. No Kraken orders.</li>
          <li>Unlock Real: KRAKEN_API_KEY, KRAKEN_API_SECRET, TRADEBOT_LIVE=true, then redeploy.</li>
          <li>Real: tap Real (confirms), then press ON. Switching to Real turns trading OFF until you press ON again.</li>
          <li>Volatility: Low = calmer coins (BTC/ETH). Med = liquid mix. High = faster, riskier names with bigger swings.</li>
          <li>Already used: GEMINI_API (or GOOGLE_API_KEY), MONGODB_URI.</li>
        </ol>
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
