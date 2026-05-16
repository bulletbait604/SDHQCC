import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { publishMetadataSchema } from '@/lib/clip-editor/schemas'
import type { FinalEditPlan, PublishMetadata, TranscriptAnalysis } from '@/lib/clip-editor/types'

export async function runMetadataPass(
  transcript: TranscriptAnalysis,
  editPlan: FinalEditPlan
): Promise<PublishMetadata> {
  const thumbAt = editPlan.rankedSegments[0]?.start ?? 0
  const prompt = `Generate publish metadata for a short-form clip.

Return JSON only:
{
  "tiktok": { "caption": string, "hashtags": string[] },
  "youtube": { "title": string, "description": string, "tags": string[], "thumbnailTimestampSeconds": number },
  "instagram": { "caption": string, "hashtags": string[] },
  "facebook": { "caption": string, "hashtags": string[] },
  "engagementScore": number
}

Rules:
- engagementScore 0-100
- hashtags without #
- thumbnailTimestampSeconds ≈ ${thumbAt.toFixed(1)}
- no explanation

Transcript:
${transcript.fullTranscript.slice(0, 8000)}`

  return geminiJsonPass(publishMetadataSchema, prompt)
}
