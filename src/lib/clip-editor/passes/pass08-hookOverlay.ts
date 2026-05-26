import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { hookOverlayPlanSchema } from '@/lib/clip-editor/schemas'
import type {
  ClipEditorPlatform,
  HookAnalysis,
  HookOverlayPlan,
  ViralityReview,
} from '@/lib/clip-editor/types'
import { platformEditingDirective } from '@/lib/platformEditing'

export async function runHookOverlayPass(
  hooks: HookAnalysis,
  platform: ClipEditorPlatform,
  viralityHints?: ViralityReview
): Promise<HookOverlayPlan> {
  const top = hooks.hooks[0]
  const prompt = `Generate opening hook overlay text for the first 2 seconds of a short-form clip.

Target platform: ${platform}
Platform directive: ${platformEditingDirective(platform)}
${viralityHints?.promptHints ? `Virality hints: ${viralityHints.promptHints}` : ''}

Goal: maximize retention. Examples: "watch this", "this gets insane", "wait for it", "ending is wild"

Return JSON only:
{
  "overlays": [
    { "start": 0, "end": 2, "text": string, "animation": "pop"|"slide"|"glitch"|"fade" }
  ]
}

Top hook context: ${top ? `${top.reason} (score ${top.score})` : 'unknown'}
Max 2 overlays. No explanation.`

  const plan = await geminiJsonPass(hookOverlayPlanSchema, prompt)
  if (plan.overlays.length > 0) return plan
  return hookOverlayPlanSchema.parse({
    overlays: [{ start: 0, end: 2, text: 'wait for it', animation: 'pop' }],
  })
}
