import type { Alignment, AlignmentWord, CaptionCue, VoiceSegment } from '@/lib/narrateMe/types'
import { formatSrtTime, formatVttTime } from '@/lib/narrateMe/config'

const MAX_CUE_WORDS = 10
const MAX_CUE_SECONDS = 4.2

export function wordsFromCharacterAlignment(
  characters: string[],
  starts: number[],
  ends: number[]
): AlignmentWord[] {
  const words: AlignmentWord[] = []
  let current = ''
  let wordStart = 0
  let wordEnd = 0
  let inWord = false

  const flush = () => {
    const word = current.trim()
    if (word) {
      words.push({ word, start: wordStart, end: wordEnd })
    }
    current = ''
    inWord = false
  }

  const n = Math.min(characters.length, starts.length, ends.length)
  for (let i = 0; i < n; i++) {
    const ch = characters[i] ?? ''
    const start = Number(starts[i]) || 0
    const end = Number(ends[i]) || start
    if (/\s/.test(ch)) {
      if (inWord) flush()
      continue
    }
    if (!inWord) {
      inWord = true
      wordStart = start
      current = ch
    } else {
      current += ch
    }
    wordEnd = end
  }
  if (inWord) flush()
  return words
}

export function alignmentFromElevenLabs(payload: {
  characters?: string[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}): Alignment {
  const characters = Array.isArray(payload.characters) ? payload.characters : []
  const starts = Array.isArray(payload.character_start_times_seconds)
    ? payload.character_start_times_seconds
    : []
  const ends = Array.isArray(payload.character_end_times_seconds)
    ? payload.character_end_times_seconds
    : []
  const words = wordsFromCharacterAlignment(characters, starts, ends)
  return {
    characters: characters.map((char, i) => ({
      char,
      start: Number(starts[i]) || 0,
      end: Number(ends[i]) || 0,
    })),
    words,
  }
}

export function cuesFromVoiceSegments(segments: VoiceSegment[]): CaptionCue[] {
  const cues: CaptionCue[] = []
  for (const segment of [...segments].sort((a, b) => a.sourceStart - b.sourceStart)) {
    const words = segment.alignment.words
    if (words.length === 0) {
      const text = segment.text.trim()
      if (!text) continue
      cues.push({
        index: cues.length + 1,
        start: segment.sourceStart,
        end: Math.max(segment.sourceStart + 0.4, segment.sourceStart + (segment.duration || 0)),
        text,
      })
      continue
    }

    let buf: AlignmentWord[] = []
    const flush = () => {
      if (buf.length === 0) return
      const start = segment.sourceStart + buf[0]!.start
      const end = segment.sourceStart + buf[buf.length - 1]!.end
      cues.push({
        index: cues.length + 1,
        start,
        end: Math.max(start + 0.35, end),
        text: buf.map((w) => w.word).join(' '),
      })
      buf = []
    }

    for (const word of words) {
      const next = [...buf, word]
      const span = next[next.length - 1]!.end - next[0]!.start
      const endPunct = /[.!?]$/.test(word.word)
      if (buf.length > 0 && (next.length > MAX_CUE_WORDS || span > MAX_CUE_SECONDS)) {
        flush()
        buf = [word]
      } else {
        buf = next
      }
      if (endPunct) flush()
    }
    flush()
  }
  return cues
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`
    )
    .join('\n')
}

export function cuesToVtt(cues: CaptionCue[]): string {
  const body = cues
    .map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}\n`)
    .join('\n')
  return `WEBVTT\n\n${body}`
}

export const CAPCUT_README = `Narrate Me — CapCut import

1. Import the original video into CapCut (the video is not included in this package).
2. Import NARRATION_FULL.wav.
3. Place the narration audio at 00:00:00.000 — silence is already baked in so lines line up with the footage.
4. Import CAPTIONS.srt (or CAPTIONS.vtt).
5. Make final edits.
6. Export from CapCut.

Do not shift individual narration clips unless you changed the video edit. The WAV is aligned to the original timeline.
`
