import { captionTimelineSchema } from '@/lib/clip-editor/schemas'
import type { CaptionTimeline, TranscriptAnalysis } from '@/lib/clip-editor/types'

const SHOUT_PATTERNS = [
  /^no way!?$/i,
  /^wait!?$/i,
  /^bro!?$/i,
  /^what\?!?$/i,
  /^omg!?$/i,
  /^insane!?$/i,
]

export function runCaptionIntelligencePass(transcript: TranscriptAnalysis): CaptionTimeline {
  const cues: CaptionTimeline['cues'] = []
  const emphasisWords: string[] = []
  let chunk: typeof transcript.words = []

  const flushChunk = () => {
    if (!chunk.length) return
    const text = chunk.map((w) => w.word).join(' ')
    const start = chunk[0].start
    const end = chunk[chunk.length - 1].end
    const upper = text.toUpperCase()
    const emphasis =
      SHOUT_PATTERNS.some((re) => re.test(text.trim())) ||
      text.includes('!') ||
      chunk.some((w) => (w.confidence || 0) > 0.92 && w.word.length > 4)
    if (emphasis) emphasisWords.push(upper.replace(/[^\w\s!?]/g, '').trim())
    cues.push({
      start,
      end,
      text: emphasis ? upper : text,
      emphasis,
      style: emphasis ? 'shout' : 'normal',
    })
    chunk = []
  }

  for (const w of transcript.words) {
    chunk.push(w)
    const endsSentence = /[.!?]$/.test(w.word) || chunk.length >= 4
    if (endsSentence) flushChunk()
  }
  flushChunk()

  return captionTimelineSchema.parse({ cues, emphasisWords: Array.from(new Set(emphasisWords)).slice(0, 24) })
}
