import type { Db } from 'mongodb'
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

/**
 * Fixed-window per-user rate limit backed by MongoDB (works across serverless instances).
 * Fails open if Mongo is unavailable so an outage never blocks paid features.
 * Default: AI_RATE_LIMIT_PER_WINDOW (30) requests per AI_RATE_LIMIT_WINDOW_SEC (600) per route.
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

export async function checkRateLimit(
  bucket: string,
  userKey: string,
  opts?: { limit?: number; windowSec?: number; nowMs?: number; db?: Pick<Db, 'collection'> }
): Promise<RateLimitResult> {
  const limit = opts?.limit ?? (Number.parseInt(process.env.AI_RATE_LIMIT_PER_WINDOW || '', 10) || 30)
  const windowSec =
    opts?.windowSec ?? (Number.parseInt(process.env.AI_RATE_LIMIT_WINDOW_SEC || '', 10) || 600)
  const now = opts?.nowMs ?? Date.now()
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec
  const id = `${bucket}:${userKey.toLowerCase()}:${windowStart}`
  try {
    const db = opts?.db ?? (await clientPromise).db('sdhq')
    const res = await db.collection('rateLimits').findOneAndUpdate(
      { _id: id as unknown as never },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((windowStart + windowSec) * 1000) },
      },
      { upsert: true, returnDocument: 'after' }
    )
    const count = (res?.value as { count?: number } | null)?.count ?? 1
    if (count > limit) {
      return { ok: false, retryAfterSec: Math.max(1, windowStart + windowSec - Math.floor(now / 1000)) }
    }
    return { ok: true }
  } catch (e) {
    console.warn('[rateLimit] check failed, allowing request:', e)
    return { ok: true }
  }
}

export function rateLimitedResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests', userMessage: 'Slow down a little — try again in a few minutes.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  )
}

/** Convenience for route handlers: returns a 429 response or null. */
export async function enforceAiRateLimit(bucket: string, username: string): Promise<NextResponse | null> {
  const r = await checkRateLimit(bucket, username)
  return r.ok ? null : rateLimitedResponse(r.retryAfterSec)
}
