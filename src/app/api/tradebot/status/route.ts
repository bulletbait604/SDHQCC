import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { latestCycleLog, listRecentFills, loadPaperLedger, markToMarket } from '@/lib/tradebot/ledger'
import { probeCryptoQuotes } from '@/lib/tradebot/crypto'
import { probeTsxQuotes } from '@/lib/tradebot/quotes'
import { universeStats } from '@/lib/tradebot/universe'
import { isTradebotPaperEnabled, tradebotGeminiKey } from '@/lib/tradebot/settings'
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

    const quoteProbe = await probeTsxQuotes()
    const cryptoProbe = await probeCryptoQuotes()
    const paper = isTradebotPaperEnabled()
    let ledger = null
    let fills: Awaited<ReturnType<typeof listRecentFills>> = []
    let lastCycle: Record<string, unknown> | null = null
    let equity: number | null = null
    let universe = { universe: 0, newListings: 0, offset: 0 }

    if (paper) {
      try {
        ledger = await loadPaperLedger()
        fills = await listRecentFills(12)
        lastCycle = await latestCycleLog()
        if (lastCycle) {
          delete lastCycle._id
        }
        const prices: Record<string, number> = {}
        if (quoteProbe.ok && quoteProbe.price) prices[quoteProbe.symbol] = quoteProbe.price
        if (cryptoProbe.ok && cryptoProbe.price) prices[cryptoProbe.symbol] = cryptoProbe.price
        equity = Number(markToMarket(ledger, prices).toFixed(2))
        universe = await universeStats()
      } catch (err) {
        console.error('[tradebot/status] ledger', err)
      }
    }

    return NextResponse.json({
      engineReady: paper && Boolean(tradebotGeminiKey()) && quoteProbe.ok,
      paperOnly: true,
      paper,
      region: 'CA',
      baseCurrency: 'CAD',
      quoteProvider: quoteProbe.source || 'yahoo',
      quotesOk: quoteProbe.ok,
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
