import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { retentionAnalysisSchema } from '@/lib/clip-editor/schemas'
import type { RetentionAnalysis, TranscriptAnalysis } from '@/lib/clip-editor/types'

export async function runRetentionAnalysisPass(
  transcript: TranscriptAnalysis
): Promise<RetentionAnalysis> {
  const prompt = `Predict audience retention for a short-form clip from this transcript.

Find: where viewers likely leave, boring sections, filler, repetition, low-energy moments.

Return JSON only:
{
  "dropMoments": [{ "start": number, "end": number, "severity": number, "reason": string }],
  "retentionCurve": [{ "atSeconds": number, "retention": number }]
}

Rules:
- severity 0-1
- retention 0-1 every ~2 seconds across duration
- max 20 dropMoments
- no explanation

Duration: ${transcript.durationSeconds.toFixed(1)}s
Pauses: ${JSON.stringify(transcript.pauses.slice(0, 20))}
Transcript:
${transcript.fullTranscript.slice(0, 12000)}`

  return geminiJsonPass(retentionAnalysisSchema, prompt)
}
