/** Turn long algorithm copy into scannable points without dropping the content. */
export function toInsightPoints(text: string): string[] {
  const raw = text.replace(/\r/g, '').trim()
  if (!raw) return []

  const byLines = raw
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[\s>*•\-]+\s*/, '')
        .replace(/^\d+[.)]\s+/, '')
        .trim()
    )
    .filter((line) => line.length > 0)
  if (byLines.length >= 3) return byLines.slice(0, 8)

  const numbered = raw
    .split(/(?:(?<=\s)|^)(?:\d+[.)]|[•\-])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12)
  if (numbered.length >= 3) return numbered.slice(0, 8)

  const sentences = raw
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (sentences.length >= 2) return sentences.slice(0, 7)

  return [raw]
}
