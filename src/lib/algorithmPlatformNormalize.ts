/**
 * Normalize / validate AI algorithm platform payloads before Mongo write + UI render.
 * Bad shapes must never reach React (e.g. summaries as string → .map crash).
 */

export type NormalizedAlgorithmPlatform = {
  keyChanges: string
  editingTips: string
  postingTips: string
  titleTips: string
  descriptionTips: string
  summaries: string[]
}

function asTrimmedString(value: unknown, max = 4000): string {
  if (typeof value === 'string') return value.trim().slice(0, max)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function asStringArray(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim().slice(0, 120))
    .slice(0, maxItems)
}

/** Returns null if the payload is too empty/broken to publish. */
export function normalizeAlgorithmPlatformData(
  raw: unknown
): NormalizedAlgorithmPlatform | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>

  const keyChanges = asTrimmedString(rec.keyChanges)
  const editingTips = asTrimmedString(rec.editingTips)
  const postingTips = asTrimmedString(rec.postingTips)
  const titleTips = asTrimmedString(rec.titleTips)
  const descriptionTips = asTrimmedString(rec.descriptionTips)
  const summaries = asStringArray(rec.summaries)

  const filledTips = [keyChanges, editingTips, postingTips, titleTips, descriptionTips].filter(
    (s) => s.length >= 40
  ).length

  // Require real content — don't overwrite good data with junk
  if (filledTips < 3 && summaries.length < 3) return null

  return {
    keyChanges: keyChanges || 'Algorithm notes unavailable for this field.',
    editingTips: editingTips || 'Editing tips unavailable for this field.',
    postingTips: postingTips || 'Posting tips unavailable for this field.',
    titleTips: titleTips || 'Title tips unavailable for this field.',
    descriptionTips: descriptionTips || 'Description tips unavailable for this field.',
    summaries:
      summaries.length > 0
        ? summaries
        : ['Review full tips below', 'Focus on early hooks', 'Post at peak local times'],
  }
}

/** Safe for UI even if Mongo has legacy/malformed entries. */
export function safeAlgorithmPlatformForUi(raw: unknown): NormalizedAlgorithmPlatform | null {
  return normalizeAlgorithmPlatformData(raw)
}

export function extractBalancedJsonObject(raw: string): string | null {
  const s = raw.trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}
