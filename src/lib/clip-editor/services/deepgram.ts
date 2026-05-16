import { resolveDeepgramApiKey } from '@/lib/clipEditorServerKeys'
import { clipEditorDeepgramModel } from '@/lib/clip-editor/env'
import type { TranscriptAnalysis } from '@/lib/clip-editor/types'
import { transcriptAnalysisSchema } from '@/lib/clip-editor/schemas'

type DeepgramWord = {
  word?: string
  punctuated_word?: string
  start?: number
  end?: number
  speaker?: number
  confidence?: number
}

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string
        words?: DeepgramWord[]
        paragraphs?: {
          paragraphs?: Array<{
            start?: number
            end?: number
            sentences?: Array<{ text?: string; start?: number; end?: number }>
          }>
        }
      }>
    }>
  }
  metadata?: { duration?: number }
}

function detectPauses(words: DeepgramWord[], minGapSeconds = 0.45) {
  const pauses: TranscriptAnalysis['pauses'] = []
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1]
    const cur = words[i]
    if (typeof prev.end !== 'number' || typeof cur.start !== 'number') continue
    const gap = cur.start - prev.end
    if (gap >= minGapSeconds) {
      pauses.push({
        start: prev.end,
        end: cur.start,
        durationSeconds: gap,
      })
    }
  }
  return pauses
}

function detectToneShifts(words: DeepgramWord[]): TranscriptAnalysis['toneShifts'] {
  const shifts: TranscriptAnalysis['toneShifts'] = []
  let window: DeepgramWord[] = []
  const flush = (atSeconds: number, label: string, intensity: number) => {
    shifts.push({ atSeconds, label, intensity })
  }
  for (const w of words) {
    window.push(w)
    if (window.length < 6) continue
    const slice = window.slice(-6)
    const text = slice.map((x) => (x.punctuated_word || x.word || '').toUpperCase()).join(' ')
    const at = slice[0].start ?? 0
    if (/!{2,}|WHAT|NO WAY|BRO|INSANE|CRAZY/.test(text)) flush(at, 'excited', 0.85)
    else if (/\?/.test(text)) flush(at, 'questioning', 0.55)
    window = window.slice(-3)
  }
  return shifts.slice(0, 24)
}

function detectEmotionSignals(words: DeepgramWord[]): TranscriptAnalysis['emotionSignals'] {
  const signals: TranscriptAnalysis['emotionSignals'] = []
  const emotionLexicon: Array<{ re: RegExp; emotion: string; intensity: number }> = [
    { re: /\b(love|hate|cry|scream|insane|crazy|wtf|omg)\b/i, emotion: 'intense', intensity: 0.8 },
    { re: /\b(lol|lmao|funny|joke)\b/i, emotion: 'humor', intensity: 0.65 },
    { re: /\b(sad|upset|mad|angry)\b/i, emotion: 'negative', intensity: 0.7 },
    { re: /\b(wow|amazing|incredible)\b/i, emotion: 'awe', intensity: 0.75 },
  ]
  for (const w of words) {
    const token = w.punctuated_word || w.word || ''
    for (const rule of emotionLexicon) {
      if (rule.re.test(token) && typeof w.start === 'number') {
        signals.push({ atSeconds: w.start, emotion: rule.emotion, intensity: rule.intensity })
        break
      }
    }
  }
  return signals.slice(0, 40)
}

export async function runTranscriptionPass(sourceUrl: string): Promise<TranscriptAnalysis> {
  const apiKey = resolveDeepgramApiKey()
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured')

  const model = clipEditorDeepgramModel()
  const url = new URL('https://api.deepgram.com/v1/listen')
  url.searchParams.set('model', model)
  url.searchParams.set('smart_format', 'true')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('diarize', 'true')
  url.searchParams.set('utterances', 'true')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: sourceUrl }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Deepgram transcription failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const payload = (await res.json()) as DeepgramResponse
  const alt = payload.results?.channels?.[0]?.alternatives?.[0]
  const rawWords = alt?.words || []
  const words = rawWords
    .filter((w) => typeof w.start === 'number' && typeof w.end === 'number')
    .map((w) => ({
      word: (w.punctuated_word || w.word || '').trim(),
      start: w.start as number,
      end: w.end as number,
      speaker: typeof w.speaker === 'number' ? w.speaker : undefined,
      confidence: typeof w.confidence === 'number' ? w.confidence : undefined,
    }))
    .filter((w) => w.word.length > 0)

  const speakers = Array.from(
    new Set(words.map((w) => w.speaker).filter((s): s is number => typeof s === 'number'))
  )
  const lastEnd = words.length ? words[words.length - 1].end : 0
  const durationSeconds =
    typeof payload.metadata?.duration === 'number' && payload.metadata.duration > 0
      ? payload.metadata.duration
      : lastEnd

  const analysis: TranscriptAnalysis = {
    fullTranscript: (alt?.transcript || words.map((w) => w.word).join(' ')).trim(),
    words,
    speakers,
    pauses: detectPauses(rawWords),
    toneShifts: detectToneShifts(rawWords),
    emotionSignals: detectEmotionSignals(rawWords),
    durationSeconds: Math.max(durationSeconds, lastEnd, 1),
  }

  return transcriptAnalysisSchema.parse(analysis)
}
