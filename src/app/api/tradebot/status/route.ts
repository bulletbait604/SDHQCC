import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { latestCycleLog, listRecentFills, loadPaperLedger, markToMarket } from '@/lib/tradebot/ledger'
import { probeCryptoQuotes } from '@/lib/tradebot/crypto'
import { probeTsxQuotes } from '@/lib/tradebot/quotes'
import { universeStats } from '@/lib/tradebot/universe'
import { getTradebotSettings, isKrakenLiveAllowed, isKrakenLiveConfigured, isPlacingLiveOrders, isTradebotPaperEnabled } from '@/lib/tradebot/settings'
import {
  envKeysPresent,
  TRADEBOT_ENV_CATALOG,
  type TradebotProviderStatus,
} from '@/lib/tradebot/envCatalog'

export const dynamic = 'force-dynamic'

/** Owner-only R&D: which TradeBot env vars are present (never returns secrets). */
export async function GET(req: NextRequest) {
  try {
    await verifyOwnerUser(req)

    const providers: TradebotProviderStatus[] = TRADEBOT_ENV_CATALOG.map((item) => ({
      id: item.id,
      group: item.group,
      label: item.label,
      keys: item.keys,
      purpose: item.purpose,
      accountUrl: item.accountUrl,
      configured: envKeysPresent(item.keys, item.requireAll),
    }))

    const required = providers.filter((p) => p.group === 'required')
    const already = providers.filter((p) => p.group === 'already')

    const settings = getTradebotSettings()
    const cryptoProbe = await probeCryptoQuotes()
    const quoteProbe = settings.cryptoOnly ? cryptoProbe : await probeTsxQuotes()
    const paper = isTradebotPaperEnabled()
    const deskOn = paper || isKrakenLiveConfigured()
    let ledger = null
    let fills: Awaited<ReturnType<typeof listRecentFills>> = []
    let lastCycle: Record<string, unknown> | null = null
    let equity: number | null = null
    let universe = { universe: 0, newListings: 0, offset: 0 }

    if (deskOn) {
      try {
        ledger = await loadPaperLedger()
        fills = await listRecentFills(12)
        lastCycle = await latestCycleLog()
        if (lastCycle) {
          delete lastCycle._id
        }
        const prices: Record<string, number> = {}
        if (!settings.cryptoOnly && quoteProbe.ok && quoteProbe.price) prices[quoteProbe.symbol] = quoteProbe.price
        if (cryptoProbe.ok && cryptoProbe.price) prices[cryptoProbe.symbol] = cryptoProbe.price
        equity = Number(markToMarket(ledger, prices).toFixed(2))
        universe = settings.cryptoOnly
          ? {
              universe: Number((lastCycle?.scan as { universe?: number } | undefined)?.universe || 0),
              newListings: Number((lastCycle?.scan as { newListings?: number } | undefined)?.newListings || 0),
              offset: 0,
            }
          : await universeStats()
      } catch (err) {
        console.error('[tradebot/status] ledger', err)
      }
    }

    const quotesOk = settings.cryptoOnly ? cryptoProbe.ok : quoteProbe.ok
    const dayStartEquity = ledger?.dayStartEquity || settings.startingCad
    const dayPnlPct =
      typeof equity === 'number' && dayStartEquity > 0
        ? Number((((equity - dayStartEquity) / dayStartEquity) * 100).toFixed(2))
        : 0
    return NextResponse.json({
      engineReady: deskOn && quotesOk,
      paperOnly: !isPlacingLiveOrders(ledger || { liveMode: false }),
      paper: isTradebotPaperEnabled() || !isPlacingLiveOrders(ledger || { liveMode: false }),
      region: 'CA',
      baseCurrency: 'CAD',
      startingCad: settings.startingCad,
      dailyProfitTargetMinPct: settings.dailyProfitTargetMinPct,
      dailyProfitTargetMaxPct: settings.dailyProfitTargetMaxPct,
      cycleMinutes: settings.cycleMinutes,
      tickSeconds: settings.tickSeconds,
      liveWatch: settings.liveWatch,
      engineOn: Boolean(ledger?.engineOn),
      liveMode: Boolean(ledger?.liveMode),
      liveAllowed: isKrakenLiveAllowed(),
      krakenLive: isPlacingLiveOrders(ledger || { liveMode: false }),
      krakenConfigured: isKrakenLiveConfigured(),
      volatility: ledger?.volatility || 'medium',
      stopPct: settings.stopPct * 100,
      takePct: settings.takePct * 100,
      maxDrawdownPct: settings.maxDrawdownPct,
      dayPnlPct,
      profitLocked: dayPnlPct >= settings.dailyProfitTargetMaxPct,
      quoteProvider: settings.cryptoOnly ? cryptoProbe.source || 'kraken' : quoteProbe.source || 'yahoo',
      quotesOk,
      quoteProbe,
      cryptoProbe,
      universe,
      requiredReady: required.every((p) => p.configured),
      reusedReady: already.every((p) => p.configured),
      providers,
      equity,
      ledger,
      fills,
      lastCycle,
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[tradebot/status]', err)
    return NextResponse.json({ error: 'Could not read TradeBot status.' }, { status: 503 })
  }
}
