import { generatePresignedReadUrl, getFileFromR2, putBufferToR2, putTextFileToR2 } from '@/lib/r2'
import { CAPCUT_README, cuesFromVoiceSegments, cuesToSrt, cuesToVtt } from '@/lib/narrateMe/captions'
import {
  assembleAlignedPcm,
  capcutZipFiles,
  pcmToWav,
  zipStore,
} from '@/lib/narrateMe/assemble'
import {
  captionsSrtKey,
  captionsVttKey,
  exportReadmeKey,
  exportZipKey,
  narrationMp3Key,
  narrationWavKey,
} from '@/lib/narrateMe/keys'
import { appBaseUrl } from '@/lib/narrateMe/kickoff'
import type { NarrateMeJob, VoiceSegment } from '@/lib/narrateMe/types'

function workerSecret(): string {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.MODAL_SECRET?.trim() ||
    ''
  )
}

export function modalAssembleUrl(): string | null {
  const explicit = process.env.MODAL_NARRATE_ME_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const profile = (process.env.MODAL_PROFILE || '').trim()
  if (!profile) return null
  return `https://${profile.toLowerCase()}--narrate-me-assemble.modal.run`
}

export type ModalAssemblePayload = {
  jobId: string
  username: string
  durationSeconds: number
  sampleRate: number
  callbackUrl: string
  segments: Array<{
    id: string
    audioKey: string
    sourceStart: number
    duration: number
    text: string
    alignment: VoiceSegment['alignment']
  }>
  keys: {
    wav: string
    mp3: string
    srt: string
    vtt: string
    readme: string
    zip: string
  }
}

export function buildModalPayload(job: NarrateMeJob): ModalAssemblePayload {
  return {
    jobId: job.jobId,
    username: job.username,
    durationSeconds: job.sourceVideo.durationSeconds,
    sampleRate: 44100,
    callbackUrl: `${appBaseUrl()}/api/narrate-me/callback`,
    segments: job.voice.segments
      .filter((s) => s.audioKey)
      .map((s) => ({
        id: s.id,
        audioKey: s.audioKey,
        sourceStart: s.sourceStart,
        duration: s.duration,
        text: s.text,
        alignment: s.alignment,
      })),
    keys: {
      wav: narrationWavKey(job.username, job.jobId),
      mp3: narrationMp3Key(job.username, job.jobId),
      srt: captionsSrtKey(job.username, job.jobId),
      vtt: captionsVttKey(job.username, job.jobId),
      readme: exportReadmeKey(job.username, job.jobId),
      zip: exportZipKey(job.username, job.jobId),
    },
  }
}

export async function triggerModalAssemble(job: NarrateMeJob): Promise<{ ok: boolean; error?: string }> {
  const url = modalAssembleUrl()
  if (!url) return { ok: false, error: 'Modal worker URL is not configured' }
  const secret = workerSecret()
  if (!secret) return { ok: false, error: 'Modal worker secret is not configured' }

  const payload = buildModalPayload(job)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200)
    return { ok: false, error: `Modal worker returned ${res.status}${text ? `: ${text}` : ''}` }
  }
  return { ok: true }
}

export async function triggerModalExtractClip(params: {
  jobId: string
  sourceKey: string
  sourceUrl: string
  startTime: number
  endTime: number
  outputKey: string
}): Promise<{ ok: boolean; error?: string; clipKey?: string; sizeBytes?: number }> {
  const url = modalAssembleUrl()
  if (!url) {
    return { ok: false, error: 'Full-video analysis needs the Modal FFmpeg worker. Deploy workers/narrate-me/worker.py.' }
  }
  const secret = workerSecret()
  if (!secret) return { ok: false, error: 'Modal worker secret is not configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 240_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        action: 'extract-clip',
        jobId: params.jobId,
        sourceKey: params.sourceKey,
        sourceUrl: params.sourceUrl,
        startTime: params.startTime,
        endTime: params.endTime,
        outputKey: params.outputKey,
      }),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => '')
    let data: { ok?: boolean; error?: string; clipKey?: string; sizeBytes?: number } = {}
    try {
      data = JSON.parse(text) as typeof data
    } catch {
      /* worker returned non-JSON */
    }
    const err = data.error || text.slice(0, 220)
    if (!res.ok || data.ok === false) {
      if (/No narration audio|segments were provided/i.test(err)) {
        return {
          ok: false,
          error: 'Redeploy the Narrate Me Modal worker to enable full-video analysis.',
        }
      }
      return { ok: false, error: err || `Modal worker returned ${res.status}` }
    }
    return { ok: true, clipKey: data.clipKey || params.outputKey, sizeBytes: data.sizeBytes }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Clip extract timed out. Retry — completed work is kept.' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Clip extract failed' }
  } finally {
    clearTimeout(timer)
  }
}

export async function assembleLocalPackage(job: NarrateMeJob): Promise<{
  wavKey: string
  mp3Key: string
  srtKey: string
  vttKey: string
  packageKey: string
}> {
  const pcmParts: Array<{ sourceStart: number; pcm: Buffer }> = []
  for (const segment of job.voice.segments) {
    if (!segment.audioKey) continue
    const pcm = await getFileFromR2(segment.audioKey)
    if (!pcm) throw new Error(`Missing audio for segment ${segment.id}`)
    pcmParts.push({ sourceStart: segment.sourceStart, pcm })
  }
  const pcm = assembleAlignedPcm({
    segments: pcmParts,
    durationSeconds: Math.max(job.sourceVideo.durationSeconds, 1),
  })
  const wav = pcmToWav(pcm)
  const cues = cuesFromVoiceSegments(job.voice.segments)
  const srt = cuesToSrt(cues)
  const vtt = cuesToVtt(cues)
  const zip = zipStore(
    capcutZipFiles({
      wav,
      srt,
      vtt,
      readme: CAPCUT_README,
    })
  )

  const wavKey = narrationWavKey(job.username, job.jobId)
  const srtKey = captionsSrtKey(job.username, job.jobId)
  const vttKey = captionsVttKey(job.username, job.jobId)
  const readmeKey = exportReadmeKey(job.username, job.jobId)
  const packageKey = exportZipKey(job.username, job.jobId)

  const wavOk = await putBufferToR2(wavKey, wav, 'audio/wav')
  const zipOk = await putBufferToR2(packageKey, zip, 'application/zip')
  const srtOk = await putTextFileToR2(srtKey, srt, 'application/x-subrip')
  const vttOk = await putTextFileToR2(vttKey, vtt, 'text/vtt')
  await putTextFileToR2(readmeKey, CAPCUT_README, 'text/plain')
  if (!wavOk || !zipOk || !srtOk || !vttOk) {
    throw new Error('Could not store assembled narration files')
  }

  return { wavKey, mp3Key: '', srtKey, vttKey, packageKey }
}

export async function signedOutputUrls(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const key of keys) {
    if (!key) continue
    const url = await generatePresignedReadUrl(key, 3600)
    if (url) out[key] = url
  }
  return out
}
