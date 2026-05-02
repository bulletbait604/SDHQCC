/**
 * Server-side owner allowlist (comma-separated usernames in OWNER_USERNAMES).
 * Mirrors client OWNER_USERNAMES so owners can use admin APIs even if Mongo role lags.
 */
export function isAllowlistedOwner(username: string): boolean {
  const raw = process.env.OWNER_USERNAMES || ''
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  return list.includes(username.toLowerCase().replace(/^@/, ''))
}
