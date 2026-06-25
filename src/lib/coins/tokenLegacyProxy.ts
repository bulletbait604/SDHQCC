import { NextResponse } from 'next/server'

/** Legacy `/api/tokens/*` routes proxy to coins — mark responses deprecated. */
export function attachTokenDeprecation(res: NextResponse): NextResponse {
  res.headers.set('Deprecation', 'true')
  res.headers.set('Sunset', 'Sat, 01 Jan 2028 00:00:00 GMT')
  res.headers.set('Link', '</api/coins/balance>; rel="successor-version"')
  return res
}

export function mapCoinsBodyToTokens(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body }
  if (typeof body.coins === 'number' && body.tokens === undefined) {
    out.tokens = body.coins
  }
  if (typeof body.remainingCoins === 'number' && body.remainingTokens === undefined) {
    out.remainingTokens = body.remainingCoins
  }
  if (typeof body.deducted === 'number') {
    out.deducted = body.deducted
  }
  return out
}

/** Map legacy camelCase tool ids to kebab-case coin tool names. */
export function legacyTokenToolToCoinTool(tool: string): string {
  const map: Record<string, string> = {
    tagGenerator: 'tag-generator',
    thumbnail: 'thumbnail-generator',
    clipAnalyzer: 'clip-analyzer',
  }
  return map[tool] ?? tool
}
