import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { viralityReviewSchema } from '@/lib/clip-editor/schemas'
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
import { platformEditingDirective } from '@/lib/platformEditing'

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
  const topSegment = params.cutRanking?.segments?.[0]

  const phaseGoal =
    params.phase === 'cut'
      ? 'Review ONLY the planned cut window, dead-air removal, and vertical layout choice. No effects or captions yet.'
      : params.phase === 'effects'
        ? 'Review ONLY pacing, zooms, transitions, and motion after cuts are locked. Text overlays come next.'
        : 'Review caption timing, hook text, keyword highlights, and scroll-stopping readability for the target platform.'

  const prompt = `You are a ${params.platform} short-form virality analyst (quality bar: beat Opus Clip and StreamLadder by using platform algorithm context).

${phaseGoal}

Platform directive: ${platformEditingDirective(params.platform)}
Algorithm notes: ${JSON.stringify(algorithmNotes)}

Source duration: ${params.transcript.durationSeconds.toFixed(1)}s
Transcript excerpt:
${params.transcript.fullTranscript.slice(0, 5000)}

${topSegment ? `Primary segment: ${topSegment.start.toFixed(1)}s–${topSegment.end.toFixed(1)}s (score ${topSegment.score})` : ''}
${params.geminiVideo?.hookTitle ? `Gemini hook title: ${params.geminiVideo.hookTitle}` : ''}
${params.geminiVideo?.layoutTemplate ? `Layout: ${params.geminiVideo.layoutTemplate}` : ''}
${params.pacing?.zooms?.length ? `Planned zooms: ${params.pacing.zooms.length}` : ''}
${params.previousReview?.promptHints ? `Prior phase hints: ${params.previousReview.promptHints}` : ''}

Return JSON only:
{
  "phase": "${params.phase}",
  "viralityScore": 0-100,
  "platformFitScore": 0-100,
  "summary": "2-3 sentences for the creator",
  "strengths": ["up to 5 bullets"],
  "risks": ["up to 5 bullets"],
  "promptHints": "Concrete instructions for the NEXT editing pass on this platform (cut density, zoom style, caption tone, etc.)",
  "recommendedAdjustments": ["actionable tweaks"]
}`

  return geminiJsonPass(viralityReviewSchema, prompt)
}
