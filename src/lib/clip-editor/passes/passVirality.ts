import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { viralityReviewSchema } from '@/lib/clip-editor/schemas'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import { excerptMinMaxSeconds } from '@/lib/clip-editor/excerptBounds'
import type {
  ClipEditorPlatform,
  CutRanking,
  FinalEditPlan,
  GeminiVideoPlan,
  PacingPlan,
  TranscriptAnalysis,
  ViralityReview,
} from '@/lib/clip-editor/types'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { resolveClipEditorAlgorithmNotes } from '@/lib/clipEditorAlgorithmNotes'
import { platformClipEditorDirective } from '@/lib/platformEditing'

function resolvePlannedExcerpt(params: {
  platform: ClipEditorPlatform
  durationSeconds: number
  cutRanking?: CutRanking
  geminiVideo?: GeminiVideoPlan
  cutPhasePlan?: FinalEditPlan
}): { start: number; end: number; lengthSeconds: number } | null {
  if (params.cutPhasePlan?.cuts?.[0]) {
    const cut = params.cutPhasePlan.cuts[0]
    const lengthSeconds = cut.end - cut.start
    return { start: cut.start, end: cut.end, lengthSeconds }
  }

  if (params.cutRanking) {
    const window = buildPrimaryClipWindow(
      params.cutRanking,
      params.durationSeconds,
      params.geminiVideo,
      params.platform
    )
    return {
      start: window.start,
      end: window.end,
      lengthSeconds: window.end - window.start,
    }
  }

  if (params.geminiVideo?.primaryWindow) {
    const pw = params.geminiVideo.primaryWindow
    return {
      start: pw.start,
      end: pw.end,
      lengthSeconds: pw.end - pw.start,
    }
  }

  return null
}

export async function runViralityReviewPass(params: {
  phase: 'cut' | 'effects' | 'text'
  platform: ClipEditorPlatform
  transcript: TranscriptAnalysis
  cutRanking?: CutRanking
  geminiVideo?: GeminiVideoPlan
  pacing?: PacingPlan
  cutPhasePlan?: FinalEditPlan
  previousReview?: ViralityReview
}): Promise<ViralityReview> {
  const snapshot = await readAlgorithmSnapshotFromMongo()
  const algorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, params.platform)
  const duration = params.transcript.durationSeconds
  const { min, ideal, max } = excerptMinMaxSeconds(params.platform, duration)

  const planned = resolvePlannedExcerpt({
    platform: params.platform,
    durationSeconds: duration,
    cutRanking: params.cutRanking,
    geminiVideo: params.geminiVideo,
    cutPhasePlan: params.cutPhasePlan,
  })

  const hookSpike = params.cutRanking?.segments?.[0]

  const phaseGoal =
    params.phase === 'cut'
      ? 'Review ONLY the planned continuous excerpt window (one uninterrupted trim), dead-air removal, and vertical layout choice. No effects or captions yet. Do NOT judge micro hook spikes — judge the full planned render length.'
      : params.phase === 'effects'
        ? 'Review ONLY pacing, zooms, transitions, and motion on the locked continuous excerpt. Text overlays come next.'
        : 'Review caption timing, hook text, keyword highlights, and scroll-stopping readability for the target platform.'

  const plannedBlock = planned
    ? `Planned continuous excerpt (THIS is the clip length to review):
- Source window: ${planned.start.toFixed(1)}s–${planned.end.toFixed(1)}s
- Render length: ${planned.lengthSeconds.toFixed(1)}s
- Platform target: ${min}–${max}s (ideal ${ideal}s)
- Edit mode: single uninterrupted excerpt (no jump-cut montage across unrelated timestamps)`
    : `Planned continuous excerpt: not computed yet (use platform minimum ${min}s–${max}s).`

  const hookContext =
    hookSpike && planned && Math.abs(hookSpike.end - hookSpike.start - planned.lengthSeconds) > 2
      ? `Peak hook moment (context only, NOT the clip length): ${hookSpike.start.toFixed(1)}s–${hookSpike.end.toFixed(1)}s (score ${hookSpike.score})`
      : hookSpike
        ? `Peak hook moment: ${hookSpike.start.toFixed(1)}s–${hookSpike.end.toFixed(1)}s (score ${hookSpike.score})`
        : ''

  const prompt = `You are a ${params.platform} short-form virality analyst (quality bar: beat Opus Clip and StreamLadder by using platform algorithm context).

${phaseGoal}

Platform directive: ${platformClipEditorDirective(params.platform)}
Algorithm notes: ${JSON.stringify(algorithmNotes)}

Source duration: ${duration.toFixed(1)}s
Transcript excerpt:
${params.transcript.fullTranscript.slice(0, 5000)}

${plannedBlock}
${hookContext}
${params.geminiVideo?.hookTitle ? `Gemini hook title: ${params.geminiVideo.hookTitle}` : ''}
${params.geminiVideo?.layoutTemplate ? `Layout: ${params.geminiVideo.layoutTemplate}` : ''}
${params.geminiVideo?.renderSeconds ? `Gemini renderSeconds: ${params.geminiVideo.renderSeconds}` : ''}
${params.pacing?.zooms?.length ? `Planned zooms: ${params.pacing.zooms.length}` : ''}
${params.previousReview?.promptHints ? `Prior phase hints: ${params.previousReview.promptHints}` : ''}

Important: Score platform fit based on the planned continuous excerpt length (${planned?.lengthSeconds.toFixed(1) ?? ideal}s), NOT a 1–2 second hook spike. For TikTok 2026, sub-${min}s clips fail FYP discoverability.

Return JSON only:
{
  "phase": "${params.phase}",
  "viralityScore": 0-100,
  "platformFitScore": 0-100,
  "summary": "2-3 sentences for the creator",
  "strengths": ["up to 5 bullets"],
  "risks": ["up to 5 bullets"],
  "promptHints": "Concrete instructions for the NEXT editing pass on this platform (hook opening, excerpt length, zoom style, caption tone, etc.)",
  "recommendedAdjustments": ["actionable tweaks"]
}`

  return geminiJsonPass(viralityReviewSchema, prompt)
}
