/** Parse Gemini bestMomentTimestamp (e.g. "1:23", "0:45", "12:34") into seconds for frame seek. */
export function parseBestMomentTimestamp(
  raw: string,
  durationSeconds?: number
): number {
  const trimmed = raw.trim()
  const clock = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (clock) {
    if (clock[3] != null) {
      return (
        parseInt(clock[1]!, 10) * 3600 +
        parseInt(clock[2]!, 10) * 60 +
        parseInt(clock[3]!, 10)
      )
    }
    return parseInt(clock[1]!, 10) * 60 + parseInt(clock[2]!, 10)
  }

  const numeric = parseFloat(trimmed.replace(/[^\d.]/g, ''))
  if (Number.isFinite(numeric) && numeric >= 0) return numeric

  if (durationSeconds != null && durationSeconds > 0) {
    return Math.min(5, Math.max(0.5, durationSeconds * 0.15))
  }
  return 1
}

export function clampSeekSeconds(timeSec: number, durationSeconds?: number): number {
  const t = Math.max(0.1, timeSec)
  if (durationSeconds != null && durationSeconds > 0.2) {
    return Math.min(t, Math.max(0.1, durationSeconds - 0.05))
  }
  return t
}
