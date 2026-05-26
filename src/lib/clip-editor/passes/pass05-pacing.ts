import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { pacingPlanSchema } from '@/lib/clip-editor/schemas'
import type {
  ClipEditorPlatform,
  CutRanking,
  PacingPlan,
  TranscriptAnalysis,
  ViralityReview,
} from '@/lib/clip-editor/types'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { resolveClipEditorAlgorithmNotes } from '@/lib/clipEditorAlgorithmNotes'
import { platformEditingDirective } from '@/lib/platformEditing'

function targetVisualChangeSeconds(platform: ClipEditorPlatform): number {
  switch (platform) {
    case 'tiktok':
      return 1.5
    case 'youtube':
      return 3
    case 'reels':
      return 2.5
    default:
      return 2
  }
}

export async function runPacingPass(
  transcript: TranscriptAnalysis,
  ranking: CutRanking,
  platform: ClipEditorPlatform,
  viralityHints?: ViralityReview
): Promise<PacingPlan> {
  const top = ranking.segments[0]
  const snapshot = await readAlgorithmSnapshotFromMongo()
  const algorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, platform)
  const prompt = `Create pacing strategy for a ${platform} short-form clip.

Platform directive: ${platformEditingDirective(platform)}
Algorithm notes: ${JSON.stringify(algorithmNotes)}
${viralityHints?.promptHints ? `Virality review hints (apply these): ${viralityHints.promptHints}` : ''}

Platform targets:
- TikTok: visual change every 1-2s, punchy zoom-ins on emphasis words
- YouTube Shorts: 2-4s, loop-friendly motion
- Instagram Reels: cinematic zooms, cleaner transitions

Return JSON only:
{
  "cuts": [{ "atSeconds": number, "type": "hard"|"soft"|"jump", "reason": string }],
  "zooms": [{ "atSeconds": number, "style": "zoomIn"|"zoomInSlow"|"zoomOut"|"zoomOutSlow", "durationSeconds": number }],
  "effectTiming": [{ "atSeconds": number, "effect": string, "durationSeconds": number }],
  "targetVisualChangeSeconds": number
}

Primary segment: ${top.start.toFixed(1)}s - ${top.end.toFixed(1)}s
Duration: ${transcript.durationSeconds.toFixed(1)}s
Transcript excerpt:
${transcript.fullTranscript.slice(0, 6000)}`

  const aiPlan = await geminiJsonPass(pacingPlanSchema, prompt)
  return pacingPlanSchema.parse({
    ...aiPlan,
    targetVisualChangeSeconds: aiPlan.targetVisualChangeSeconds || targetVisualChangeSeconds(platform),
  })
}
