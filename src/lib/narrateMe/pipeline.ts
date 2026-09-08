import { deleteFileFromR2, generatePresignedReadUrl, getR2ObjectMetadata, getR2ObjectStream, putTextFileToR2 } from '@/lib/r2'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import {
  analysisCacheKey,
  analysisWindows,
  hashNarrationText,
  NARRATE_ME_COIN_COST,
  NARRATE_ME_LOCAL_ASSEMBLE_MAX_SECONDS,
  NARRATE_ME_MAX_BYTES,
  NARRATE_ME_MAX_DURATION_SECONDS,
  NARRATE_ME_TOOL,
  NARRATE_ME_VOICE_BATCH,
  narrateMeGeminiApiKey,
  narrateMeGeminiModel,
  userFacingNarrateMeError,
} from '@/lib/narrateMe/config'
import {
  analysisClipKey,
  analysisJsonKey,
  scriptJsonKey,
  sourceVideoKey,
  timelineJsonKey,
} from '@/lib/narrateMe/keys'
import {
  createNarrateMeJob,
  getNarrateMeJobById,
  getNarrateMeJobForUser,
  listActiveNarrateMeJobs,
  newNarrateMeJobId,
  acquireNarrateMeTickLock,
  releaseNarrateMeTickLock,
  updateNarrateMeJob,
} from '@/lib/narrateMe/history'
import { analyzeVideoChunk, mergeTimelineEvents } from '@/lib/narrateMe/gemini'
import { generateNarrationScript, regenerateNarrationSegment } from '@/lib/narrateMe/script'
import { synthesizeNarrationSegment } from '@/lib/narrateMe/elevenlabs'
import { cleanupLocalFfmpegJob, extractClipWithLocalFfmpeg, localFfmpegAvailable } from '@/lib/narrateMe/ffmpegLocal'
import { assembleLocalPackage, modalAssembleUrl, triggerModalAssemble, triggerModalExtractClip } from '@/lib/narrateMe/modal'
import { applyProgress } from '@/lib/narrateMe/progress'
import { kickNarrateMeTick } from '@/lib/narrateMe/kickoff'
import {
  deleteGeminiUploadedFile,
  GEMINI_FILES_MAX_BYTES,
  pollGeminiFileUntilActive,
  uploadIterableToGeminiFilesApi,
} from '@/lib/geminiFiles'
import type {
  AnalysisChunk,
  NarrateMeJob,
  NarrationSegment,
  TimelineEvent,
} from '@/lib/narrateMe/types'

export { getNarrateMeJobForUser, newNarrateMeJobId }

function nowIso(): string {
  return new Date().toISOString()
}

async function persistJob(job: NarrateMeJob, patch: Partial<NarrateMeJob> = {}): Promise<NarrateMeJob> {
  const next = { ...job, ...patch, updatedAt: nowIso() }
  const progress = applyProgress(next)
  const saved = { ...next, ...progress }
  await updateNarrateMeJob(job.jobId, saved)
  return saved
}

async function cacheJson(key: string, value: unknown): Promise<void> {
  await putTextFileToR2(key, JSON.stringify(value), 'application/json')
}

export function emptyJob(params: {
  user: VerifiedUser
  prompt: string
  fileName: string
  mimeType: string
  durationSeconds: number
}): NarrateMeJob {
  const jobId = newNarrateMeJobId()
  const stamp = nowIso()
  const fileKey = sourceVideoKey(params.user.username, jobId, params.fileName, params.mimeType)
  return {
    jobId,
    userId: params.user.id,
    username: params.user.username.toLowerCase(),
    status: 'awaiting_upload',
    currentStage: 'upload',
    progress: 2,
    progressLabel: 'Waiting for video upload',
    prompt: params.prompt.trim(),
    sourceVideo: {
      fileKey,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: 0,
      durationSeconds: params.durationSeconds,
      uploadedAt: '',
    },
    analysis: {
      status: 'idle',
      progress: 0,
      totalChunks: 0,
      completedChunks: 0,
      chunks: [],
      cacheKey: '',
      model: '',
      completedAt: '',
      geminiFileUri: '',
      geminiFileName: '',
    },
    timeline: [],
    script: {
      status: 'idle',
      segments: [],
      version: 0,
      approved: false,
      updatedAt: '',
    },
    voice: {
      status: 'idle',
      voiceId: '',
      segments: [],
      completedCount: 0,
      completedAt: '',
    },
    audio: { status: 'idle', wavKey: '', mp3Key: '' },
    captions: { status: 'idle', srtKey: '', vttKey: '' },
    export: { status: 'idle', packageKey: '' },
    error: '',
    retryable: true,
    createdAt: stamp,
    updatedAt: stamp,
    startedAt: stamp,
  }
}

export async function createUploadJob(params: {
  user: VerifiedUser
  prompt: string
  fileName: string
  mimeType: string
  durationSeconds: number
}): Promise<NarrateMeJob> {
  if (params.prompt.trim().length < 8) {
    throw Object.assign(new Error('Enter a short prompt describing what to narrate.'), { status: 400 })
  }
  if (params.durationSeconds > NARRATE_ME_MAX_DURATION_SECONDS + 30) {
    throw Object.assign(new Error('Videos longer than 2 hours are not supported.'), { status: 400 })
  }
  const job = emptyJob(params)
  await createNarrateMeJob(job)
  return job
}

export async function markUploaded(
  job: NarrateMeJob,
  sizeBytes: number
): Promise<NarrateMeJob> {
  if (sizeBytes > NARRATE_ME_MAX_BYTES) {
    throw Object.assign(new Error('Video is too large (12 GB max).'), { status: 400 })
  }
  return persistJob(job, {
    status: 'uploaded',
    error: '',
    sourceVideo: {
      ...job.sourceVideo,
      sizeBytes,
      uploadedAt: nowIso(),
    },
  })
}

function initChunks(durationSeconds: number, previous: AnalysisChunk[] = []): AnalysisChunk[] {
  const prev = new Map(
    previous.map((c) => [`${c.index}:${c.startTime}:${c.endTime}`, c] as const)
  )
  return analysisWindows(durationSeconds).map((w) => {
    const old = prev.get(`${w.index}:${w.startTime}:${w.endTime}`)
    return {
      index: w.index,
      startTime: w.startTime,
      endTime: w.endTime,
      status: 'idle' as const,
      eventCount: 0,
      error: '',
      clipKey: old?.clipKey || '',
    }
  })
}

export async function startAnalysis(job: NarrateMeJob, user?: VerifiedUser): Promise<NarrateMeJob> {
  if (!job.sourceVideo.fileKey || !job.sourceVideo.uploadedAt) {
    throw Object.assign(new Error('Upload the video before analyzing.'), { status: 400 })
  }
  if (user && job.analysis.status !== 'complete') {
    const spend = await spendToolCoins(user, NARRATE_ME_TOOL, NARRATE_ME_COIN_COST)
    if (!spend.ok) {
      throw Object.assign(
        new Error(
          spend.reason === 'Insufficient coins'
            ? `Not enough coins. Narrate Me costs ${NARRATE_ME_COIN_COST}.`
            : spend.reason
        ),
        { status: spend.status }
      )
    }
  }
  const cacheKey = analysisCacheKey(
    job.sourceVideo.fileKey,
    job.sourceVideo.sizeBytes,
    job.sourceVideo.durationSeconds
  )
  if (job.analysis.status === 'complete' && job.analysis.cacheKey === cacheKey && job.timeline.length > 0) {
    if (job.script.segments.length > 0) {
      return persistJob(job, {
        status: 'awaiting_script_approval',
        error: '',
      })
    }
    return persistJob(job, {
      status: 'analyzing',
      analysis: { ...job.analysis, status: 'running' },
      error: '',
      startedAt: job.startedAt || nowIso(),
    })
  }

  const chunks = initChunks(
    job.sourceVideo.durationSeconds || 1,
    job.analysis.cacheKey === cacheKey ? job.analysis.chunks : []
  )
  const keepGemini =
    job.analysis.cacheKey === cacheKey && job.analysis.geminiFileUri && job.analysis.geminiFileName
      ? {
          geminiFileUri: job.analysis.geminiFileUri,
          geminiFileName: job.analysis.geminiFileName,
        }
      : { geminiFileUri: '', geminiFileName: '' }
  const next = await persistJob(job, {
    status: 'analyzing',
    error: '',
    retryable: true,
    startedAt: nowIso(),
    analysis: {
      status: 'running',
      progress: 0,
      totalChunks: chunks.length,
      completedChunks: 0,
      chunks,
      cacheKey,
      model: narrateMeGeminiModel(),
      completedAt: '',
      ...keepGemini,
    },
    timeline: [],
    script: { status: 'idle', segments: [], version: 0, approved: false, updatedAt: '' },
    voice: { status: 'idle', voiceId: '', segments: [], completedCount: 0, completedAt: '' },
    audio: { status: 'idle', wavKey: '', mp3Key: '' },
    captions: { status: 'idle', srtKey: '', vttKey: '' },
    export: { status: 'idle', packageKey: '' },
  })
  kickNarrateMeTick(job.jobId)
  return next
}

async function ensureGeminiVideoFile(job: NarrateMeJob): Promise<NarrateMeJob> {
  if (job.analysis.geminiFileUri && job.analysis.geminiFileName) return job
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const meta = await getR2ObjectMetadata(job.sourceVideo.fileKey)
  const sizeBytes = meta?.contentLength || job.sourceVideo.sizeBytes
  if (sizeBytes > GEMINI_FILES_MAX_BYTES) {
    throw new Error(
      'This video is larger than 2 GB. Deploy the Narrate Me Modal worker (extract-clip) to analyze it on the live site.'
    )
  }

  const stream = await getR2ObjectStream(job.sourceVideo.fileKey)
  if (!stream) throw new Error('Could not load the uploaded video for analysis')

  const mime = job.sourceVideo.mimeType.startsWith('video/')
    ? job.sourceVideo.mimeType
    : 'video/mp4'
  const uploaded = await uploadIterableToGeminiFilesApi({
    apiKey,
    body: stream.body,
    sizeBytes: stream.contentLength || sizeBytes,
    mimeType: mime,
    displayName: `narrate-me-${job.jobId}`,
  })
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 90, retryDelayMs: 2000 })
  return persistJob(job, {
    analysis: {
      ...job.analysis,
      geminiFileUri: uploaded.uri,
      geminiFileName: uploaded.name,
    },
    sourceVideo: {
      ...job.sourceVideo,
      sizeBytes: job.sourceVideo.sizeBytes || sizeBytes,
    },
  })
}

async function releaseGeminiVideoFile(job: NarrateMeJob): Promise<void> {
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey || !job.analysis.geminiFileName) return
  await deleteGeminiUploadedFile(apiKey, job.analysis.geminiFileName).catch(() => undefined)
}

async function cleanupAnalysisClips(job: NarrateMeJob): Promise<void> {
  for (const chunk of job.analysis.chunks) {
    if (chunk.clipKey) await deleteFileFromR2(chunk.clipKey).catch(() => undefined)
  }
  await cleanupLocalFfmpegJob(job.jobId)
}

async function ensureAnalysisClip(job: NarrateMeJob, chunk: AnalysisChunk): Promise<string> {
  const clipKey = chunk.clipKey || analysisClipKey(job.username, job.jobId, chunk.index)
  const existing = await getR2ObjectMetadata(clipKey)
  if (existing && existing.contentLength > 1000) return clipKey

  if (await localFfmpegAvailable()) {
    await extractClipWithLocalFfmpeg({
      jobId: job.jobId,
      sourceKey: job.sourceVideo.fileKey,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      outputKey: clipKey,
    })
    return clipKey
  }

  const sourceUrl = await generatePresignedReadUrl(job.sourceVideo.fileKey, 7200)
  if (!sourceUrl) throw new Error('Could not create a video read URL for clip extract')

  const result = await triggerModalExtractClip({
    jobId: job.jobId,
    sourceKey: job.sourceVideo.fileKey,
    sourceUrl,
    startTime: chunk.startTime,
    endTime: chunk.endTime,
    outputKey: clipKey,
  })
  if (!result.ok) {
    throw new Error(result.error || 'Clip extract failed')
  }
  return result.clipKey || clipKey
}

async function analyzeChunkFromClip(
  job: NarrateMeJob,
  chunk: AnalysisChunk
): Promise<TimelineEvent[]> {
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  if (!chunk.clipKey) throw new Error('Analysis clip is missing')

  const meta = await getR2ObjectMetadata(chunk.clipKey)
  if (!meta) throw new Error('Analysis clip missing from storage')
  if (meta.contentLength > GEMINI_FILES_MAX_BYTES) {
    throw new Error('This video span is too large for analysis. Retry this step.')
  }

  const stream = await getR2ObjectStream(chunk.clipKey)
  if (!stream) throw new Error('Could not load the analysis clip')

  const uploaded = await uploadIterableToGeminiFilesApi({
    apiKey,
    body: stream.body,
    sizeBytes: stream.contentLength || meta.contentLength,
    mimeType: 'video/mp4',
    displayName: `narrate-me-${job.jobId}-c${chunk.index}`,
  })
  try {
    await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 60, retryDelayMs: 2000 })
    return analyzeVideoChunk({
      fileUri: uploaded.uri,
      mimeType: 'video/mp4',
      prompt: job.prompt,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      durationSeconds: job.sourceVideo.durationSeconds,
      chunkIndex: chunk.index,
      clipRelative: true,
    })
  } finally {
    await deleteGeminiUploadedFile(apiKey, uploaded.name).catch(() => undefined)
  }
}

async function runNextAnalysisChunk(job: NarrateMeJob): Promise<NarrateMeJob> {
  const chunks = [...job.analysis.chunks]
  const running = chunks.find((c) => c.status === 'running')
  if (running) {
    const age = Date.now() - Date.parse(job.updatedAt)
    if (Number.isFinite(age) && age < 4 * 60 * 1000) return job
    running.status = 'failed'
    running.error = running.error || 'Analysis timed out. Retrying this span.'
  }

  const hasLocalFfmpeg = await localFfmpegAvailable()
  const sizeBytes = job.sourceVideo.sizeBytes || 0
  const tooBigForWholeFile = sizeBytes > GEMINI_FILES_MAX_BYTES
  // Local: FFmpeg clips. Production: whole-file Gemini under 2 GB; Modal clips only above that
  // so Vercel does not depend on a new extract-clip worker for normal uploads.
  const clipMode = hasLocalFfmpeg || (tooBigForWholeFile && Boolean(modalAssembleUrl()))

  const nextChunk = chunks.find((c) => c.status === 'idle' || c.status === 'failed')
  if (!nextChunk) {
    await releaseGeminiVideoFile(job)
    await cleanupAnalysisClips(job)
    return persistJob(job, {
      status: 'awaiting_script_approval',
      script: { ...job.script, status: job.script.status === 'complete' ? 'complete' : 'running' },
      analysis: {
        ...job.analysis,
        status: 'complete',
        progress: 100,
        completedAt: job.analysis.completedAt || nowIso(),
        geminiFileUri: '',
        geminiFileName: '',
        chunks: chunks.map((c) => ({ ...c, clipKey: '' })),
      },
    })
  }

  if (!clipMode && (!job.analysis.geminiFileUri || !job.analysis.geminiFileName)) {
    try {
      return await ensureGeminiVideoFile(job)
    } catch (err) {
      return persistJob(job, {
        analysis: { ...job.analysis, chunks, status: 'failed' },
        status: 'failed',
        error: userFacingNarrateMeError(err),
        retryable: true,
      })
    }
  }

  nextChunk.status = 'running'
  nextChunk.error = ''
  await persistJob(job, {
    analysis: { ...job.analysis, chunks, status: 'running' },
    status: 'analyzing',
    error: '',
  })

  try {
    let events: TimelineEvent[]
    if (clipMode) {
      nextChunk.clipKey = await ensureAnalysisClip(job, nextChunk)
      await persistJob(job, {
        analysis: { ...job.analysis, chunks, status: 'running' },
        status: 'analyzing',
        error: '',
      })
      events = await analyzeChunkFromClip(job, nextChunk)
    } else {
      events = await analyzeVideoChunk({
        fileUri: job.analysis.geminiFileUri,
        mimeType: job.sourceVideo.mimeType,
        prompt: job.prompt,
        startTime: nextChunk.startTime,
        endTime: nextChunk.endTime,
        durationSeconds: job.sourceVideo.durationSeconds,
        chunkIndex: nextChunk.index,
      })
    }
    const timeline = mergeTimelineEvents(job.timeline, events)
    nextChunk.status = 'complete'
    nextChunk.eventCount = events.length
    const completedChunks = chunks.filter((c) => c.status === 'complete').length
    const analysis = {
      ...job.analysis,
      chunks,
      completedChunks,
      progress: Math.round((completedChunks / Math.max(1, chunks.length)) * 100),
      status: completedChunks >= chunks.length ? ('complete' as const) : ('running' as const),
    }
    const saved = await persistJob(job, { timeline, analysis, status: 'analyzing', error: '' })
    await cacheJson(timelineJsonKey(job.username, job.jobId), timeline)
    if (analysis.status === 'complete') {
      await releaseGeminiVideoFile(saved)
      await cleanupAnalysisClips(saved)
      return persistJob(saved, {
        status: 'awaiting_script_approval',
        script: { ...saved.script, status: 'running' },
        analysis: {
          ...saved.analysis,
          status: 'complete',
          progress: 100,
          completedAt: nowIso(),
          geminiFileUri: '',
          geminiFileName: '',
          chunks: saved.analysis.chunks.map((c) => ({ ...c, clipKey: '' })),
        },
      })
    }
    return saved
  } catch (err) {
    nextChunk.status = 'failed'
    nextChunk.error = userFacingNarrateMeError(err)
    return persistJob(job, {
      analysis: { ...job.analysis, chunks, status: 'failed' },
      status: 'failed',
      error: nextChunk.error,
      retryable: true,
    })
  }
}

async function finishAnalysis(job: NarrateMeJob): Promise<NarrateMeJob> {
  if (job.script.status === 'complete' && job.script.segments.length > 0) {
    return persistJob(job, {
      analysis: {
        ...job.analysis,
        status: 'complete',
        progress: 100,
        completedAt: job.analysis.completedAt || nowIso(),
      },
      status: 'awaiting_script_approval',
      error: '',
    })
  }
  await cacheJson(analysisJsonKey(job.username, job.jobId), {
    cacheKey: job.analysis.cacheKey,
    model: job.analysis.model,
    timeline: job.timeline,
  })
  const writing = await persistJob(job, {
    analysis: {
      ...job.analysis,
      status: 'complete',
      progress: 100,
      completedAt: nowIso(),
    },
    script: { ...job.script, status: 'running' },
    status: 'awaiting_script_approval',
    currentStage: 'writing',
    error: '',
  })
  try {
    const segments = await generateNarrationScript({
      prompt: job.prompt,
      timeline: writing.timeline,
    })
    const saved = await persistJob(writing, {
      script: {
        status: 'complete',
        segments,
        version: (job.script.version || 0) + 1,
        approved: false,
        updatedAt: nowIso(),
      },
      status: 'awaiting_script_approval',
      error: '',
    })
    await cacheJson(scriptJsonKey(job.username, job.jobId), saved.script)
    return saved
  } catch (err) {
    return persistJob(writing, {
      script: { ...writing.script, status: 'failed' },
      status: 'failed',
      error: userFacingNarrateMeError(err),
      retryable: true,
    })
  }
}

export async function regenerateJobScript(job: NarrateMeJob): Promise<NarrateMeJob> {
  if (job.timeline.length === 0) {
    throw Object.assign(new Error('Analyze the video before generating a script.'), { status: 400 })
  }
  const writing = await persistJob(job, {
    script: { ...job.script, status: 'running' },
    status: 'awaiting_script_approval',
    error: '',
  })
  const segments = await generateNarrationScript({
    prompt: job.prompt,
    timeline: job.timeline,
  })
  const saved = await persistJob(writing, {
    script: {
      status: 'complete',
      segments,
      version: job.script.version + 1,
      approved: false,
      updatedAt: nowIso(),
    },
    voice: { status: 'idle', voiceId: '', segments: [], completedCount: 0, completedAt: '' },
    audio: { status: 'idle', wavKey: '', mp3Key: '' },
    captions: { status: 'idle', srtKey: '', vttKey: '' },
    export: { status: 'idle', packageKey: '' },
    error: '',
  })
  await cacheJson(scriptJsonKey(job.username, job.jobId), saved.script)
  return saved
}

export async function patchScript(
  job: NarrateMeJob,
  body: {
    segments?: Array<{ id: string; text?: string; sourceStart?: number; sourceEnd?: number }>
    order?: string[]
    deleteIds?: string[]
  }
): Promise<NarrateMeJob> {
  let segments = [...job.script.segments]
  const deleteIds = new Set(body.deleteIds || [])
  if (deleteIds.size) segments = segments.filter((s) => !deleteIds.has(s.id))

  if (Array.isArray(body.segments)) {
    for (const patch of body.segments) {
      const idx = segments.findIndex((s) => s.id === patch.id)
      if (idx === -1) continue
      const current = segments[idx]!
      const text = typeof patch.text === 'string' ? patch.text.trim().slice(0, 800) : current.text
      const next: NarrationSegment = {
        ...current,
        text,
        sourceStart:
          typeof patch.sourceStart === 'number' ? patch.sourceStart : current.sourceStart,
        sourceEnd: typeof patch.sourceEnd === 'number' ? patch.sourceEnd : current.sourceEnd,
        textHash: hashNarrationText(text),
        version: current.version + (text !== current.text ? 1 : 0),
      }
      segments[idx] = next
    }
  }

  if (Array.isArray(body.order) && body.order.length > 0) {
    const map = new Map(segments.map((s) => [s.id, s]))
    const ordered: NarrationSegment[] = []
    for (const id of body.order) {
      const row = map.get(id)
      if (row) ordered.push(row)
    }
    for (const row of segments) {
      if (!ordered.some((s) => s.id === row.id)) ordered.push(row)
    }
    segments = ordered
  }

  const voiceKeep = job.voice.segments.filter((v) => {
    const match = segments.find((s) => s.id === v.id)
    return !!match && match.textHash === v.textHash && !!v.audioKey
  })

  const saved = await persistJob(job, {
    script: {
      ...job.script,
      segments,
      version: job.script.version + 1,
      approved: false,
      updatedAt: nowIso(),
      status: 'complete',
    },
    voice: {
      ...job.voice,
      segments: voiceKeep,
      completedCount: voiceKeep.length,
      status: voiceKeep.length === segments.length && segments.length > 0 ? 'complete' : 'idle',
    },
    audio: { status: 'idle', wavKey: '', mp3Key: '' },
    captions: { status: 'idle', srtKey: '', vttKey: '' },
    export: { status: 'idle', packageKey: '' },
    status: 'awaiting_script_approval',
    error: '',
  })
  await cacheJson(scriptJsonKey(job.username, job.jobId), saved.script)
  return saved
}

export async function regenerateOneSegment(
  job: NarrateMeJob,
  segmentId: string
): Promise<NarrateMeJob> {
  const segment = job.script.segments.find((s) => s.id === segmentId)
  if (!segment) throw Object.assign(new Error('Segment not found.'), { status: 404 })
  const event = job.timeline.find((e) => e.id === segment.eventId)
  const text = await regenerateNarrationSegment({
    prompt: job.prompt,
    segment,
    event,
  })
  return patchScript(job, { segments: [{ id: segmentId, text }] })
}

export async function startVoice(job: NarrateMeJob): Promise<NarrateMeJob> {
  if (job.script.segments.length === 0) {
    throw Object.assign(new Error('Approve or generate a script first.'), { status: 400 })
  }
  const next = await persistJob(job, {
    status: 'generating_voice',
    script: { ...job.script, approved: true },
    voice: {
      ...job.voice,
      status: 'running',
      voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || job.voice.voiceId,
    },
    audio: { status: 'idle', wavKey: job.audio.wavKey, mp3Key: job.audio.mp3Key },
    error: '',
  })
  kickNarrateMeTick(job.jobId)
  return next
}

async function runVoiceBatch(job: NarrateMeJob): Promise<NarrateMeJob> {
  const cached = new Map(job.voice.segments.map((v) => [v.id, v]))
  const pending = job.script.segments.filter((s) => {
    const existing = cached.get(s.id)
    return !existing || existing.textHash !== s.textHash || !existing.audioKey
  })
  if (pending.length === 0) {
    return startAudioAssembly(
      await persistJob(job, {
        voice: {
          ...job.voice,
          status: 'complete',
          completedCount: job.script.segments.length,
          completedAt: nowIso(),
        },
      })
    )
  }

  const batch = pending.slice(0, NARRATE_ME_VOICE_BATCH)
  const voiceSegs = [...job.voice.segments]
  try {
    for (const segment of batch) {
      const generated = await synthesizeNarrationSegment({
        username: job.username,
        jobId: job.jobId,
        segment,
      })
      const idx = voiceSegs.findIndex((v) => v.id === generated.id)
      if (idx >= 0) voiceSegs[idx] = generated
      else voiceSegs.push(generated)
    }
    const completedCount = job.script.segments.filter((s) => {
      const v = voiceSegs.find((row) => row.id === s.id)
      return v && v.textHash === s.textHash && v.audioKey
    }).length
    const saved = await persistJob(job, {
      status: 'generating_voice',
      voice: {
        ...job.voice,
        status: completedCount >= job.script.segments.length ? 'complete' : 'running',
        segments: voiceSegs,
        completedCount,
      },
      error: '',
    })
    if (saved.voice.status === 'complete') return startAudioAssembly(saved)
    return saved
  } catch (err) {
    return persistJob(job, {
      voice: { ...job.voice, segments: voiceSegs, status: 'failed' },
      status: 'failed',
      error: userFacingNarrateMeError(err),
      retryable: true,
    })
  }
}

export async function startAudioAssembly(job: NarrateMeJob): Promise<NarrateMeJob> {
  const queued = await persistJob(job, {
    status: 'processing_audio',
    audio: { ...job.audio, status: 'running' },
    captions: { ...job.captions, status: 'running' },
    export: { ...job.export, status: 'running' },
    error: '',
  })

  const modal = await triggerModalAssemble(queued)
  if (modal.ok) {
    return queued
  }

  if (job.sourceVideo.durationSeconds <= NARRATE_ME_LOCAL_ASSEMBLE_MAX_SECONDS) {
    try {
      const assembled = await assembleLocalPackage(queued)
      return persistJob(queued, {
        status: 'ready',
        audio: { status: 'complete', wavKey: assembled.wavKey, mp3Key: assembled.mp3Key },
        captions: { status: 'complete', srtKey: assembled.srtKey, vttKey: assembled.vttKey },
        export: { status: 'complete', packageKey: assembled.packageKey },
        error: '',
      })
    } catch (err) {
      return persistJob(queued, {
        status: 'failed',
        audio: { ...queued.audio, status: 'failed' },
        error: userFacingNarrateMeError(err),
        retryable: true,
      })
    }
  }

  return persistJob(queued, {
    status: 'failed',
    audio: { ...queued.audio, status: 'failed' },
    error: modal.error || 'Modal worker is not configured',
    retryable: true,
  })
}

export async function retryJob(job: NarrateMeJob): Promise<NarrateMeJob> {
  if (job.status === 'ready') return job
  if (job.analysis.status !== 'complete' || job.timeline.length === 0) {
    return startAnalysis(job)
  }
  if (job.script.status !== 'complete' || job.script.segments.length === 0) {
    return regenerateJobScript(job)
  }
  if (job.voice.status !== 'complete') {
    return startVoice(job)
  }
  return startAudioAssembly(job)
}

export async function tickNarrateMeJob(jobId: string): Promise<NarrateMeJob | null> {
  const locked = await acquireNarrateMeTickLock(jobId)
  if (!locked) {
    return getNarrateMeJobById(jobId)
  }
  let next: NarrateMeJob | null = null
  try {
    const job = await getNarrateMeJobById(jobId)
    if (!job) return null
    if (job.status === 'ready' || job.status === 'awaiting_upload' || job.status === 'uploaded') {
      return job
    }
    if (job.status === 'awaiting_script_approval') {
      next = job.script.status === 'running' ? await finishAnalysis(job) : job
      return next
    }
    if (job.status === 'analyzing' || job.analysis.status === 'running') {
      next = await runNextAnalysisChunk(job)
      return next
    }
    if (job.status === 'generating_voice' || job.voice.status === 'running') {
      next = await runVoiceBatch(job)
      return next
    }
    if (job.status === 'processing_audio') {
      if (job.export.status === 'complete' && job.audio.wavKey) {
        next = await persistJob(job, { status: 'ready', error: '' })
        return next
      }
      return job
    }
    return job
  } finally {
    await releaseNarrateMeTickLock(jobId)
    if (
      next &&
      (next.status === 'analyzing' ||
        next.status === 'generating_voice' ||
        (next.status === 'awaiting_script_approval' && next.script.status === 'running'))
    ) {
      kickNarrateMeTick(next.jobId)
    }
  }
}

export async function tickActiveJobs(limit = 4): Promise<number> {
  const jobs = await listActiveNarrateMeJobs(limit)
  let n = 0
  for (const job of jobs) {
    await tickNarrateMeJob(job.jobId)
    n += 1
  }
  return n
}

export function publicJob(job: NarrateMeJob): NarrateMeJob {
  if (!job.analysis.geminiFileUri && !job.analysis.geminiFileName) return job
  return {
    ...job,
    analysis: {
      ...job.analysis,
      geminiFileUri: '',
      geminiFileName: '',
    },
  }
}
