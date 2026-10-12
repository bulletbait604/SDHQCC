import crypto from 'crypto'

/**
 * Generated thumbnails are private R2 objects. New keys are namespaced per user:
 *   thumbnails/u/<user>/<session>/<uuid>.<ext>
 * /api/image serves a thumbnails/ key only to its owner, to staff, or to anyone
 * holding a short-lived HMAC-signed URL (exp + sig) minted by the server.
 */
export const THUMBNAIL_SIGNED_URL_TTL_SEC = 15 * 60

function seg(s: string, fallback: string): string {
  const v = s.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64)
  return v || fallback
}

export function thumbnailUserPrefix(username: string): string {
  return `thumbnails/u/${seg(username, 'user')}/`
}

/** Scope passed as `sessionId` into key builders: `u/<user>/<session>`. */
export function thumbnailScope(username: string, sessionId: unknown): string {
  const s = typeof sessionId === 'string' ? seg(sessionId, '') : ''
  return `u/${seg(username, 'user')}/${s || crypto.randomUUID()}`
}

export function userOwnsThumbnailKey(key: string, username: string): boolean {
  return key.startsWith(thumbnailUserPrefix(username))
}

function signingSecret(): string | null {
  const s = process.env.IMAGE_URL_SIGNING_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET
  return s && s.length > 0 ? s : null
}

function hmac(secret: string, key: string, exp: number): string {
  return crypto.createHmac('sha256', secret).update(`img:${key}:${exp}`).digest('base64url')
}

/** Short-lived signed proxy URL for a private R2 object. */
export function signedImageUrl(
  key: string,
  ttlSec: number = THUMBNAIL_SIGNED_URL_TTL_SEC,
  nowMs: number = Date.now()
): string {
  const base = `/api/image?key=${encodeURIComponent(key)}`
  const secret = signingSecret()
  if (!secret) return base
  const exp = Math.floor(nowMs / 1000) + ttlSec
  return `${base}&exp=${exp}&sig=${hmac(secret, key, exp)}`
}

export function verifyImageSignature(
  key: string,
  exp: string | null,
  sig: string | null,
  nowMs: number = Date.now()
): boolean {
  const secret = signingSecret()
  if (!secret || !exp || !sig) return false
  const expNum = Number.parseInt(exp, 10)
  if (!Number.isFinite(expNum) || expNum * 1000 < nowMs) return false
  const expected = Buffer.from(hmac(secret, key, expNum))
  const got = Buffer.from(sig)
  return expected.length === got.length && crypto.timingSafeEqual(expected, got)
}
