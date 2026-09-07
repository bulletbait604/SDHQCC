import { putBufferToR2, putTextFileToR2 } from '@/lib/r2'
import {
  ELEVENLABS_PCM_FORMAT,
  elevenLabsApiKey,
  elevenLabsVoiceId,
  NARRATE_ME_SAMPLE_RATE,
} from '@/lib/narrateMe/config'
import { voiceMetaKey, voiceSegmentKey } from '@/lib/narrateMe/keys'
import { alignmentFromElevenLabs } from '@/lib/narrateMe/captions'
import { voiceDurationSeconds } from '@/lib/narrateMe/assemble'
import type { Alignment, NarrationSegment, VoiceSegment } from '@/lib/narrateMe/types'

type ElevenLabsTimestampResponse = {
  audio_base64?: string
  alignment?: {
    characters?: string[]
    character_start_times_seconds?: number[]
    character_end_times_seconds?: number[]
  }
  normalized_alignment?: {
    characters?: string[]
    character_start_times_seconds?: number[]
    character_end_times_seconds?: number[]
  }
}

function alignmentDuration(alignment: Alignment): number {
  const lastWord = alignment.words[alignment.words.length - 1]
  const lastChar = alignment.characters[alignment.characters.length - 1]
  const fromAlign = Math.max(lastWord?.end || 0, lastChar?.end || 0)
  return fromAlign
}

export async function synthesizeNarrationSegment(params: {
  username: string
  jobId: string
  segment: NarrationSegment
}): Promise<VoiceSegment> {
  const apiKey = elevenLabsApiKey()
  const voiceId = elevenLabsVoiceId()
  if (!apiKey) throw new Error('ELEVEN_LABS_API is not configured')
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is not configured')

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${ELEVENLABS_PCM_FORMAT}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text: params.segment.text,
      model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    }),
  })

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 240)
    throw new Error(`ElevenLabs failed (${res.status})${detail ? `: ${detail}` : ''}`)
  }

  const requestId =
    res.headers.get('request-id') ||
    res.headers.get('x-request-id') ||
    res.headers.get('xi-request-id') ||
    ''

  const payload = (await res.json()) as ElevenLabsTimestampResponse
  const audioB64 = payload.audio_base64
  if (!audioB64) throw new Error('ElevenLabs returned no audio')

  const pcm = Buffer.from(audioB64, 'base64')
  if (pcm.length < 64) throw new Error('ElevenLabs returned empty audio')

  const rawAlign = payload.normalized_alignment || payload.alignment || {}
  const alignment = alignmentFromElevenLabs(rawAlign)
  const duration = Math.max(
    voiceDurationSeconds(pcm.length, NARRATE_ME_SAMPLE_RATE),
    alignmentDuration(alignment)
  )

  const audioKey = voiceSegmentKey(params.username, params.jobId, params.segment.id)
  const metaKey = voiceMetaKey(params.username, params.jobId, params.segment.id)
  const stored = await putBufferToR2(audioKey, pcm, 'application/octet-stream')
  if (!stored) throw new Error('Could not store narration audio')
  await putTextFileToR2(
    metaKey,
    JSON.stringify({
      id: params.segment.id,
      text: params.segment.text,
      textHash: params.segment.textHash,
      duration,
      alignment,
      elevenLabsRequestId: requestId,
    }),
    'application/json'
  )

  return {
    id: params.segment.id,
    sourceStart: params.segment.sourceStart,
    sourceEnd: params.segment.sourceEnd,
    text: params.segment.text,
    textHash: params.segment.textHash,
    elevenLabsRequestId: requestId,
    audioKey,
    duration,
    sampleRate: NARRATE_ME_SAMPLE_RATE,
    alignment,
  }
}
