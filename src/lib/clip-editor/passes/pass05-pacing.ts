import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { pacingPlanSchema } from '@/lib/clip-editor/schemas'
import type {
  ClipEditorPlatform,
  CutRanking,
  GeminiVideoPlan,
  PacingPlan,
  TranscriptAnalysis,
  ViralityReview,
} from '@/lib/clip-editor/types'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { resolveClipEditorAlgorithmNotes } from '@/lib/clipEditorAlgorithmNotes'
import { platformClipEditorDirective } from '@/lib/platformEditing'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'

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
  viralityHints?: ViralityReview,
  geminiVideo?: GeminiVideoPlan
): Promise<PacingPlan> {
  const excerpt = buildPrimaryClipWindow(ranking, transcript.durationSeconds, geminiVideo, platform)
  const snapshot = await readAlgorithmSnapshotFromMongo()
  const algorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, platform)
  const prompt = `Create pacing strategy for a ${platform} short-form clip.

Platform directive: ${platformClipEditorDirective(platform)}
Algorithm notes: ${JSON.stringify(algorithmNotes)}
${viralityHints?.promptHints ? `Virality review hints (apply these): ${viralityHints.promptHints}` : ''}

This clip uses ONE continuous excerpt (no jump-cut montage). Pacing = subtle zooms and motion within the excerpt, not hard cuts every 1.5s.

Platform targets:
- TikTok: gentle opening zoom for 3s hook, then 1 subtle zoom every 4-6s within the excerpt
- YouTube Shorts: loop-friendly motion, 2-4s visual changes
- Instagram Reels: cinematic zooms, cleaner transitions

Return JSON only:
{
  "cuts": [{ "atSeconds": number, "type": "hard"|"soft"|"jump", "reason": string }],
  "zooms": [{ "atSeconds": number, "style": "zoomIn"|"zoomInSlow"|"zoomOut"|"zoomOutSlow", "durationSeconds": number }],
  "effectTiming": [{ "atSeconds": number, "effect": string, "durationSeconds": number }],
  "targetVisualChangeSeconds": number
}

Continuous excerpt: ${excerpt.start.toFixed(1)}s - ${excerpt.end.toFixed(1)}s (${(excerpt.end - excerpt.start).toFixed(1)}s)
Duration: ${transcript.durationSeconds.toFixed(1)}s
Transcript excerpt:
${transcript.fullTranscript.slice(0, 6000)}`

  const aiPlan = await geminiJsonPass(pacingPlanSchema, prompt)
  return pacingPlanSchema.parse({
    ...aiPlan,
    targetVisualChangeSeconds: aiPlan.targetVisualChangeSeconds || targetVisualChangeSeconds(platform),
  })
}
