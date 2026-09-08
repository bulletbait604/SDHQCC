import { randomUUID } from 'crypto'
import clientPromise from '@/lib/mongodb'
import type {
  AnalysisChunk,
  NarrateMeJob,
  NarrateMeJobStatus,
  NarrateMeStage,
  NarrationSegment,
  StageStatus,
  TimelineEvent,
  VideoAnalysis,
  VoiceSegment,
} from '@/lib/narrateMe/types'

const COLLECTION = 'narrateMeJobs'
const DB = 'sdhq'

function col() {
  return clientPromise.then((c) => c.db(DB).collection(COLLECTION))
}

function asStringArray(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim().slice(0, 240))
    .slice(0, max)
}

function mapTimeline(raw: unknown): TimelineEvent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      const start = Number(rec.startTime)
      const end = Number(rec.endTime)
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null
      return {
        id: String(rec.id || ''),
        startTime: start,
        endTime: end,
        event: String(rec.event || '').slice(0, 400),
        visibleElements: asStringArray(rec.visibleElements),
        actions: asStringArray(rec.actions),
        ocr: asStringArray(rec.ocr),
        entities: asStringArray(rec.entities),
        quantities: asStringArray(rec.quantities),
        uiState: asStringArray(rec.uiState),
        dialogue: asStringArray(rec.dialogue),
        evidence: asStringArray(rec.evidence),
        confidence: Math.min(1, Math.max(0, Number(rec.confidence) || 0)),
        chunkIndex: Number(rec.chunkIndex) || 0,
      } satisfies TimelineEvent
    })
    .filter((row): row is TimelineEvent => !!row)
}

function mapSegments(raw: unknown): NarrationSegment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      return {
        id: String(rec.id || ''),
        sourceStart: Number(rec.sourceStart) || 0,
        sourceEnd: Number(rec.sourceEnd) || 0,
        text: String(rec.text || ''),
        eventId: String(rec.eventId || ''),
        confidence: Math.min(1, Math.max(0, Number(rec.confidence) || 0)),
        evidence: asStringArray(rec.evidence),
        textHash: String(rec.textHash || ''),
        version: Number(rec.version) || 1,
      } satisfies NarrationSegment
    })
    .filter((row): row is NarrationSegment => !!row && !!row.id)
}

function mapVoice(raw: unknown): VoiceSegment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      const alignmentRaw =
        rec.alignment && typeof rec.alignment === 'object'
          ? (rec.alignment as Record<string, unknown>)
          : {}
      const chars = Array.isArray(alignmentRaw.characters) ? alignmentRaw.characters : []
      const words = Array.isArray(alignmentRaw.words) ? alignmentRaw.words : []
      return {
        id: String(rec.id || ''),
        sourceStart: Number(rec.sourceStart) || 0,
        sourceEnd: Number(rec.sourceEnd) || 0,
        text: String(rec.text || ''),
        textHash: String(rec.textHash || ''),
        elevenLabsRequestId: String(rec.elevenLabsRequestId || ''),
        audioKey: String(rec.audioKey || ''),
        duration: Number(rec.duration) || 0,
        sampleRate: Number(rec.sampleRate) || 44100,
        alignment: {
          characters: chars
            .map((c) => {
              if (!c || typeof c !== 'object') return null
              const row = c as Record<string, unknown>
              return {
                char: String(row.char || ''),
                start: Number(row.start) || 0,
                end: Number(row.end) || 0,
              }
            })
            .filter((c): c is { char: string; start: number; end: number } => !!c),
          words: words
            .map((w) => {
              if (!w || typeof w !== 'object') return null
              const row = w as Record<string, unknown>
              return {
                word: String(row.word || ''),
                start: Number(row.start) || 0,
                end: Number(row.end) || 0,
              }
            })
            .filter((w): w is { word: string; start: number; end: number } => !!w),
        },
      } satisfies VoiceSegment
    })
    .filter((row): row is VoiceSegment => !!row && !!row.id)
}

function mapChunks(raw: unknown): AnalysisChunk[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      index: Number(rec.index) || 0,
      startTime: Number(rec.startTime) || 0,
      endTime: Number(rec.endTime) || 0,
      status: (rec.status as StageStatus) || 'idle',
      eventCount: Number(rec.eventCount) || 0,
      error: String(rec.error || ''),
      clipKey: String(rec.clipKey || ''),
    }
  })
}

function emptyAnalysis(): VideoAnalysis {
  return {
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
  }
}

export function mapNarrateMeJob(r: Record<string, unknown>): NarrateMeJob {
  const source =
    r.sourceVideo && typeof r.sourceVideo === 'object'
      ? (r.sourceVideo as Record<string, unknown>)
      : {}
  const analysis =
    r.analysis && typeof r.analysis === 'object' ? (r.analysis as Record<string, unknown>) : {}
  const script = r.script && typeof r.script === 'object' ? (r.script as Record<string, unknown>) : {}
  const voice = r.voice && typeof r.voice === 'object' ? (r.voice as Record<string, unknown>) : {}
  const audio = r.audio && typeof r.audio === 'object' ? (r.audio as Record<string, unknown>) : {}
  const captions =
    r.captions && typeof r.captions === 'object' ? (r.captions as Record<string, unknown>) : {}
  const exported =
    r.export && typeof r.export === 'object' ? (r.export as Record<string, unknown>) : {}

  return {
    jobId: String(r.jobId || r.id || r._id || ''),
    userId: String(r.userId || ''),
    username: String(r.username || ''),
    status: (r.status as NarrateMeJobStatus) || 'failed',
    currentStage: (r.currentStage as NarrateMeStage) || 'upload',
    progress: Number(r.progress) || 0,
    progressLabel: String(r.progressLabel || ''),
    prompt: String(r.prompt || ''),
    sourceVideo: {
      fileKey: String(source.fileKey || ''),
      fileName: String(source.fileName || ''),
      mimeType: String(source.mimeType || 'video/mp4'),
      sizeBytes: Number(source.sizeBytes) || 0,
      durationSeconds: Number(source.durationSeconds) || 0,
      uploadedAt: String(source.uploadedAt || ''),
    },
    analysis: {
      ...emptyAnalysis(),
      status: (analysis.status as StageStatus) || 'idle',
      progress: Number(analysis.progress) || 0,
      totalChunks: Number(analysis.totalChunks) || 0,
      completedChunks: Number(analysis.completedChunks) || 0,
      chunks: mapChunks(analysis.chunks),
      cacheKey: String(analysis.cacheKey || ''),
      model: String(analysis.model || ''),
      completedAt: String(analysis.completedAt || ''),
      geminiFileUri: String(analysis.geminiFileUri || ''),
      geminiFileName: String(analysis.geminiFileName || ''),
    },
    timeline: mapTimeline(r.timeline),
    script: {
      status: (script.status as StageStatus) || 'idle',
      segments: mapSegments(script.segments),
      version: Number(script.version) || 0,
      approved: Boolean(script.approved),
      updatedAt: String(script.updatedAt || ''),
    },
    voice: {
      status: (voice.status as StageStatus) || 'idle',
      voiceId: String(voice.voiceId || ''),
      segments: mapVoice(voice.segments),
      completedCount: Number(voice.completedCount) || 0,
      completedAt: String(voice.completedAt || ''),
    },
    audio: {
      status: (audio.status as StageStatus) || 'idle',
      wavKey: String(audio.wavKey || ''),
      mp3Key: String(audio.mp3Key || ''),
    },
    captions: {
      status: (captions.status as StageStatus) || 'idle',
      srtKey: String(captions.srtKey || ''),
      vttKey: String(captions.vttKey || ''),
    },
    export: {
      status: (exported.status as StageStatus) || 'idle',
      packageKey: String(exported.packageKey || ''),
    },
    error: String(r.error || ''),
    retryable: r.retryable !== false,
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
    startedAt: String(r.startedAt || ''),
  }
}

export async function createNarrateMeJob(doc: NarrateMeJob): Promise<void> {
  await (await col()).insertOne({ ...doc })
}

export async function updateNarrateMeJob(
  jobId: string,
  patch: Partial<NarrateMeJob> | Record<string, unknown>
): Promise<void> {
  await (await col()).updateOne(
    { jobId },
    { $set: { ...patch, updatedAt: new Date().toISOString() } }
  )
}

export async function getNarrateMeJobForUser(
  jobId: string,
  username: string
): Promise<NarrateMeJob | null> {
  const row = await (await col()).findOne({
    jobId,
    username: username.toLowerCase(),
  })
  if (!row) return null
  return mapNarrateMeJob(row as Record<string, unknown>)
}

export async function getNarrateMeJobById(jobId: string): Promise<NarrateMeJob | null> {
  const row = await (await col()).findOne({ jobId })
  if (!row) return null
  return mapNarrateMeJob(row as Record<string, unknown>)
}

export async function listNarrateMeJobsForUser(
  username: string,
  limit = 12
): Promise<NarrateMeJob[]> {
  const rows = await (await col())
    .find({ username: username.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return rows.map((r) => mapNarrateMeJob(r as Record<string, unknown>))
}

export async function listActiveNarrateMeJobs(limit = 6): Promise<NarrateMeJob[]> {
  const rows = await (await col())
    .find({
      $or: [
        { status: { $in: ['analyzing', 'generating_voice', 'processing_audio'] } },
        { status: 'awaiting_script_approval', 'script.status': 'running' },
      ],
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray()
  return rows.map((r) => mapNarrateMeJob(r as Record<string, unknown>))
}

export async function claimNarrateMeStatus(
  jobId: string,
  from: NarrateMeJobStatus | NarrateMeJobStatus[],
  to: NarrateMeJobStatus,
  extra?: Partial<NarrateMeJob>
): Promise<boolean> {
  const fromList = Array.isArray(from) ? from : [from]
  const result = await (await col()).updateOne(
    { jobId, status: { $in: fromList } },
    { $set: { status: to, updatedAt: new Date().toISOString(), ...(extra || {}) } }
  )
  return (result.modifiedCount || 0) > 0
}

export async function acquireNarrateMeTickLock(jobId: string, ttlMs = 280_000): Promise<boolean> {
  const now = Date.now()
  const result = await (await col()).updateOne(
    {
      jobId,
      $or: [{ tickLockUntil: { $exists: false } }, { tickLockUntil: { $lte: now } }],
    },
    { $set: { tickLockUntil: now + ttlMs, updatedAt: new Date().toISOString() } }
  )
  return (result.modifiedCount || 0) > 0
}

export async function releaseNarrateMeTickLock(jobId: string): Promise<void> {
  await (await col()).updateOne({ jobId }, { $set: { tickLockUntil: 0 } })
}

export function newNarrateMeJobId(): string {
  return randomUUID()
}

export function newSegmentId(): string {
  return randomUUID()
}
