import { generatePresignedReadUrl, putTextFileToR2 } from '@/lib/r2'
import type { TranscriptAnalysis } from '@/lib/clip-editor/types'

type ResolvedSegment = {
  start: number
  length: number
  trim: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function formatVttTimestamp(seconds: number): string {
  const s = Math.max(0, seconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = Math.floor(s % 60)
  const millis = Math.round((s % 1) * 1000)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`
}

function mapSourceSecondToTimeline(
  sourceSecond: number,
  segments: ResolvedSegment[]
): number | null {
  let timeline = 0
  for (const seg of segments) {
    const sourceStart = seg.trim
    const sourceEnd = seg.trim + seg.length
    if (sourceSecond < sourceStart - 0.05) return null
    if (sourceSecond <= sourceEnd + 0.05) {
      return timeline + clamp(sourceSecond - sourceStart, 0, seg.length)
    }
    timeline += seg.length
  }
  return null
}

export function buildTimelineCaptionVtt(
  words: TranscriptAnalysis['words'],
  segments: ResolvedSegment[]
): string | null {
  if (!words.length || !segments.length) return null

  const cues: Array<{ start: number; end: number; text: string }> = []
  let cueWords: string[] = []
  let cueStart: number | null = null
  let cueEnd: number | null = null

  const flush = () => {
    if (cueStart == null || cueEnd == null || cueEnd <= cueStart || !cueWords.length) {
      cueWords = []
      cueStart = null
      cueEnd = null
      return
    }
    cues.push({
      start: cueStart,
      end: Math.max(cueStart + 0.45, cueEnd),
      text: cueWords.join(' '),
    })
    cueWords = []
    cueStart = null
    cueEnd = null
  }

  for (const word of words) {
    const text = word.word.trim()
    const timelineStart = mapSourceSecondToTimeline(word.start, segments)
    const timelineEnd = mapSourceSecondToTimeline(word.end, segments)
    if (!text || timelineStart == null || timelineEnd == null) {
      flush()
      continue
    }

    if (cueStart == null) cueStart = timelineStart
    const gap = cueEnd == null ? 0 : timelineStart - cueEnd
    if (cueWords.length >= 5 || gap > 0.35 || /[.!?]$/.test(cueWords[cueWords.length - 1] || '')) {
      flush()
      cueStart = timelineStart
    }
    cueWords.push(text)
    cueEnd = timelineEnd
    if (cues.length >= 72) break
  }
  flush()
  if (!cues.length) return null

  const lines = ['WEBVTT', '']
  cues.forEach((cue, index) => {
    lines.push(String(index + 1))
    lines.push(`${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}`)
    lines.push(cue.text)
    lines.push('')
  })
  return lines.join('\n')
}

export async function uploadClipEditorCaptionVtt(params: {
  username: string
  words: TranscriptAnalysis['words']
  segments: ResolvedSegment[]
}): Promise<string | null> {
  const vtt = buildTimelineCaptionVtt(params.words, params.segments)
  if (!vtt) return null
  const key = `uploads/clips/${params.username}/${Date.now()}-opus-captions.vtt`
  const wrote = await putTextFileToR2(key, vtt, 'text/vtt; charset=utf-8')
  if (!wrote) return null
  return generatePresignedReadUrl(key, 86400)
}

export function readResolvedSegmentsFromShotstack(
  shotstack: Record<string, unknown>
): ResolvedSegment[] {
  const meta = shotstack.metadata as { resolvedSegments?: ResolvedSegment[] } | undefined
  const raw = meta?.resolvedSegments
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (s) =>
        typeof s.start === 'number' &&
        typeof s.length === 'number' &&
        typeof s.trim === 'number'
    )
    .map((s) => ({
      start: s.start,
      length: s.length,
      trim: s.trim,
    }))
}
