/** Strip copy/paste noise so ArenaNet keys and JWT subtokens still authenticate. */
export function normalizeGw2ApiKey(raw: string): string {
  let key = raw.replace(/^\uFEFF/, '').trim()
  key = key.replace(/^["'`]+/, '').replace(/["'`]+$/, '').trim()
  key = key.replace(/^Bearer\s+/i, '').trim()
  return key.replace(/\s+/g, '')
}
