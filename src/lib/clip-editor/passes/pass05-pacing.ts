import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { pacingPlanSchema } from '@/lib/clip-editor/schemas'
import type { ClipEditorPlatform, CutRanking, PacingPlan, TranscriptAnalysis } from '@/lib/clip-editor/types'

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
  platform: ClipEditorPlatform
): Promise<PacingPlan> {
  const top = ranking.segments[0]
  const prompt = `Create pacing strategy for a ${platform} short-form clip.

Platform targets:
- TikTok: visual change every 1-2s
- YouTube Shorts: 2-4s
- Instagram Reels: cleaner pacing
- Facebook: slower

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
