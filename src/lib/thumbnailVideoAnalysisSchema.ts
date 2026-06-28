import { z } from 'zod'

const FIELD_LIMITS = {
  bestMomentTimestamp: 40,
  subjectDescription: 500,
  emotionalHook: 200,
  onImageTextItem: 60,
  onImageTextCount: 4,
  colorPalette: 400,
  compositionNotes: 400,
  viralThumbnailBrief: 1200,
  algorithmAlignment: 500,
} as const

export const thumbnailVideoAnalysisSchema = z.object({
  bestMomentTimestamp: z.string().max(FIELD_LIMITS.bestMomentTimestamp),
  subjectDescription: z.string().max(FIELD_LIMITS.subjectDescription),
  emotionalHook: z.string().max(FIELD_LIMITS.emotionalHook),
  onImageText: z
    .array(z.string().max(FIELD_LIMITS.onImageTextItem))
    .max(FIELD_LIMITS.onImageTextCount),
  colorPalette: z.string().max(FIELD_LIMITS.colorPalette),
  compositionNotes: z.string().max(FIELD_LIMITS.compositionNotes),
  viralThumbnailBrief: z.string().max(FIELD_LIMITS.viralThumbnailBrief),
  algorithmAlignment: z.string().max(FIELD_LIMITS.algorithmAlignment),
})

export type ThumbnailVideoAnalysis = z.infer<typeof thumbnailVideoAnalysisSchema>

function truncateString(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** Truncate Gemini overflow before Zod parse so video analysis does not fail on verbose fields. */
export function preprocessThumbnailVideoAnalysisRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  const onImageText = Array.isArray(o.onImageText)
    ? o.onImageText
        .filter((t): t is string => typeof t === 'string')
        .map((t) => truncateString(t, FIELD_LIMITS.onImageTextItem))
        .filter(Boolean)
        .slice(0, FIELD_LIMITS.onImageTextCount)
    : []

  return {
    ...o,
    bestMomentTimestamp: truncateString(o.bestMomentTimestamp, FIELD_LIMITS.bestMomentTimestamp),
    subjectDescription: truncateString(o.subjectDescription, FIELD_LIMITS.subjectDescription),
    emotionalHook: truncateString(o.emotionalHook, FIELD_LIMITS.emotionalHook),
    onImageText,
    colorPalette: truncateString(o.colorPalette, FIELD_LIMITS.colorPalette),
    compositionNotes: truncateString(o.compositionNotes, FIELD_LIMITS.compositionNotes),
    viralThumbnailBrief: truncateString(o.viralThumbnailBrief, FIELD_LIMITS.viralThumbnailBrief),
    algorithmAlignment: truncateString(o.algorithmAlignment, FIELD_LIMITS.algorithmAlignment),
  }
}

export function parseThumbnailVideoAnalysisJson(raw: string): ThumbnailVideoAnalysis {
  let clean = raw.trim()
  if (clean.includes('```')) {
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  const parsed = JSON.parse(clean) as unknown
  return thumbnailVideoAnalysisSchema.parse(preprocessThumbnailVideoAnalysisRaw(parsed))
}
