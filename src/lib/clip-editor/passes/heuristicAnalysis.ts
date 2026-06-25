import {
  geminiVideoPlanSchema,
  hookAnalysisSchema,
  retentionAnalysisSchema,
} from '@/lib/clip-editor/schemas'
import type {
  ClipEditorPlatform,
  ClipLayoutTemplate,
  GeminiVideoPlan,
  HookAnalysis,
  RetentionAnalysis,
  TranscriptAnalysis,
} from '@/lib/clip-editor/types'

const HOOK_TRIGGERS = [
  'wait',
  'insane',
  'crazy',
  'never',
  'secret',
  'best',
  'worst',
  'why',
  'how',
  'what',
  'bro',
  'omg',
]

function windowHookScore(words: TranscriptAnalysis['words'], start: number, end: number): number {
  const slice = words.filter((w) => w.start >= start && w.end <= end + 0.15)
  if (!slice.length) return 40
  const text = slice.map((w) => w.word.toLowerCase()).join(' ')
  let score = 45
  if (/[!?]/.test(slice.map((w) => w.word).join(' '))) score += 18
  if (HOOK_TRIGGERS.some((t) => text.includes(t))) score += 15
  const wps = slice.length / Math.max(0.5, end - start)
  if (wps > 2.8) score += 10
  return Math.min(92, score)
}

export function buildHeuristicHookAnalysis(transcript: TranscriptAnalysis): HookAnalysis {
  const duration = transcript.durationSeconds
  const hooks: HookAnalysis['hooks'] = []
  const windowSize = Math.min(8, Math.max(3, duration * 0.12))

  for (let start = 0; start < Math.max(1, duration - 2); start += windowSize * 0.65) {
    const end = Math.min(duration, start + windowSize)
    const score = windowHookScore(transcript.words, start, end)
    if (score < 52 && hooks.length >= 2) continue
    hooks.push({
      start,
      end,
      score,
      reason: score >= 70 ? 'High-energy speech window' : 'Transcript segment candidate',
      category: score >= 75 ? 'surprise' : 'other',
    })
    if (hooks.length >= 8) break
  }

  if (!hooks.length) {
    hooks.push({
      start: 0,
      end: Math.min(duration, 12),
      score: 55,
      reason: 'Opening window fallback',
      category: 'other',
    })
  }

  hooks.sort((a, b) => b.score - a.score)
  return hookAnalysisSchema.parse({ hooks: hooks.slice(0, 10) })
}

export function buildHeuristicRetentionAnalysis(transcript: TranscriptAnalysis): RetentionAnalysis {
  const duration = transcript.durationSeconds
  const dropMoments: RetentionAnalysis['dropMoments'] = []

  for (const pause of transcript.pauses) {
    if (pause.durationSeconds < 0.45) continue
    dropMoments.push({
      start: pause.start,
      end: pause.end,
      severity: Math.min(1, pause.durationSeconds / 2.2),
      reason: 'Dead air / pause',
    })
  }

  const step = Math.max(1.5, duration / 24)
  const retentionCurve: RetentionAnalysis['retentionCurve'] = []
  for (let t = 0; t <= duration; t += step) {
    const inDrop = dropMoments.some((d) => t >= d.start && t <= d.end)
    const decay = Math.max(0.35, 1 - t / (duration * 1.35))
    retentionCurve.push({
      atSeconds: Number(t.toFixed(2)),
      retention: inDrop ? decay * 0.55 : decay,
    })
  }

  return retentionAnalysisSchema.parse({
    dropMoments: dropMoments.slice(0, 12),
    retentionCurve,
  })
}

export function buildHeuristicGeminiVideoPlan(params: {
  transcript: TranscriptAnalysis
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
}): GeminiVideoPlan {
  const { transcript, platform, layoutTemplate } = params
  const hooks = buildHeuristicHookAnalysis(transcript)
  const top = hooks.hooks[0]
  const end = Math.min(transcript.durationSeconds, top.end + 8)
  const titleWords = transcript.words
    .slice(0, 10)
    .map((w) => w.word)
    .join(' ')
    .slice(0, 42)

  return geminiVideoPlanSchema.parse({
    hookTitle: titleWords || 'watch this',
    hookSubtitle: platform === 'tiktok' ? 'wait for it' : undefined,
    hookPlan: 'Fast tier: transcript-driven hook from highest-scoring speech window.',
    pacePlan: 'Rule-based zooms on emphasis; no Gemini video pass.',
    contentType: 'unknown',
    layoutTemplate: layoutTemplate === 'auto' ? 'focusCrop' : layoutTemplate,
    cutSeconds: platform === 'tiktok' ? 2 : 2.6,
    introHookSeconds: 2,
    renderSeconds: Math.min(38, Math.max(14, end - top.start)),
    captionStyle: 'bold',
    hookStyle: 'pop',
    primaryWindow: {
      start: top.start,
      end,
      confidence: 0.55,
      reason: top.reason || 'Heuristic hook window',
    },
  })
}
