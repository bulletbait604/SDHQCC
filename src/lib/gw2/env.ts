/** Owner fallback only. Regular users store an encrypted key in Mongo after Kick login. */
export function readGw2ApiKey(): string | null {
  const key = (process.env.GUILDWARS_API || process.env.GW2_API_KEY || '').trim()
  return key || null
}
