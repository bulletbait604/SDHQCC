import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { hookAnalysisSchema } from '@/lib/clip-editor/schemas'
import type { HookAnalysis, TranscriptAnalysis } from '@/lib/clip-editor/types'

export async function runHookAnalysisPass(transcript: TranscriptAnalysis): Promise<HookAnalysis> {
  const excerpt = transcript.fullTranscript.slice(0, 12000)
  const prompt = `You are a short-form retention editor (OpusClip / StreamLadder quality).

Analyze this transcript and identify the strongest hooks for a vertical short.

Detect moments with: surprise, controversy, humor, emotion, curiosity, challenge, arguments, gaming highlights, reaction moments.

Return JSON only:
{
  "hooks": [
    { "start": number, "end": number, "score": number, "reason": string, "category": "surprise"|"controversy"|"humor"|"emotion"|"curiosity"|"challenge"|"argument"|"gaming"|"reaction"|"other" }
  ]
}

Rules:
- scores 0-100
- each hook window 2-12 seconds
- max 12 hooks
- use seconds from transcript timing
- no explanation outside JSON

Transcript (${transcript.durationSeconds.toFixed(1)}s):
${excerpt}

Word timing sample (first 80):
${transcript.words
  .slice(0, 80)
  .map((w) => `${w.start.toFixed(2)}-${w.end.toFixed(2)}: ${w.word}`)
  .join('\n')}`

  return geminiJsonPass(hookAnalysisSchema, prompt)
}
