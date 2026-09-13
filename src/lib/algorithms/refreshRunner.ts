import type { NextResponse } from 'next/server'

export type AlgorithmRefreshOpts = {
  platformId?: string
  force?: boolean
  source?: 'monthly-cron' | 'staff' | 'internal'
  actorUsername?: string
}

type AlgorithmRefreshFn = (opts?: AlgorithmRefreshOpts) => Promise<NextResponse>

let impl: AlgorithmRefreshFn | null = null

export function setAlgorithmRefreshImpl(fn: AlgorithmRefreshFn) {
  impl = fn
}

/** Used by monthly cron. Loads the algorithms route once so the runner is registered. */
export async function runAlgorithmRefresh(opts?: AlgorithmRefreshOpts): Promise<NextResponse> {
  if (!impl) {
    await import('@/app/api/algorithms/route')
  }
  if (!impl) {
    throw new Error('Algorithm refresh runner is not registered')
  }
  return impl(opts)
}
