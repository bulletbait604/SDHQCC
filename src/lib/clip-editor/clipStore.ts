import clientPromise from '@/lib/mongodb'
import type { ViralSegment } from '@/lib/clip-editor/types'

export type ClipEditorVideoStatus =
  | 'pending'
  | 'analyzing'
  | 'clipping'
  | 'completed'
  | 'failed'

export type ClipEditorClipStatus = 'pending' | 'rendering' | 'completed' | 'failed'

export type ClipEditorVideoDocument = {
  _id: string
  userId: string
  username: string
  jobId: string
  r2FileKey: string
  r2Url: string
  status: ClipEditorVideoStatus
  createdAt: string
  updatedAt: string
}

export type ClipEditorClipDocument = {
  _id: string
  videoId: string
  jobId: string
  title: string
  explanation: string
  startTime: number
  endTime: number
  viralityScore: number
  shotstackJobId?: string
  finalVideoUrl?: string
  finalR2Key?: string
  status: ClipEditorClipStatus
  selected: boolean
  createdAt: string
  updatedAt: string
}

const VIDEOS = 'clipEditorVideos'
const CLIPS = 'clipEditorClips'

function mapJobStateToVideoStatus(state: string): ClipEditorVideoStatus {
  if (state === 'FAILED') return 'failed'
  if (state === 'COMPLETE') return 'completed'
  if (
    state === 'RENDERING' ||
    state === 'RENDERING_CUT_PREVIEW' ||
    state === 'RENDERING_EFFECTS_PREVIEW' ||
    state === 'EDIT_PLAN' ||
    state === 'CAPTIONING' ||
    state === 'PACING' ||
    state === 'BROLL_PLANNING' ||
    state === 'VIRALITY_EFFECTS'
  ) {
    return 'clipping'
  }
  if (state === 'UPLOADED') return 'pending'
  return 'analyzing'
}

export async function upsertVideoForJob(params: {
  jobId: string
  userId: string
  username: string
  r2FileKey: string
  r2Url: string
  state?: string
}): Promise<ClipEditorVideoDocument> {
  const db = await clientPromise
  const col = db.db('sdhq').collection<ClipEditorVideoDocument>(VIDEOS)
  const now = new Date().toISOString()
  const status = mapJobStateToVideoStatus(params.state || 'UPLOADED')

  const existing = await col.findOne({ jobId: params.jobId })
  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          r2Url: params.r2Url,
          status,
          updatedAt: now,
        },
      }
    )
    return { ...existing, r2Url: params.r2Url, status, updatedAt: now }
  }

  const doc: ClipEditorVideoDocument = {
    _id: params.jobId,
    userId: params.userId,
    username: params.username,
    jobId: params.jobId,
    r2FileKey: params.r2FileKey,
    r2Url: params.r2Url,
    status,
    createdAt: now,
    updatedAt: now,
  }
  await col.insertOne(doc)
  return doc
}

export async function updateVideoStatusForJob(
  jobId: string,
  state: string
): Promise<void> {
  const db = await clientPromise
  const status = mapJobStateToVideoStatus(state)
  await db.db('sdhq').collection(VIDEOS).updateOne(
    { jobId },
    { $set: { status, updatedAt: new Date().toISOString() } }
  )
}

export async function replaceClipsForVideo(params: {
  videoId: string
  jobId: string
  segments: ViralSegment[]
}): Promise<ClipEditorClipDocument[]> {
  const db = await clientPromise
  const col = db.db('sdhq').collection<ClipEditorClipDocument>(CLIPS)
  const now = new Date().toISOString()

  await col.deleteMany({ videoId: params.videoId })

  if (params.segments.length === 0) return []

  const docs: ClipEditorClipDocument[] = params.segments.map((seg, index) => ({
    _id: `${params.jobId}-clip-${index}`,
    videoId: params.videoId,
    jobId: params.jobId,
    title: seg.title,
    explanation: seg.explanation,
    startTime: seg.start,
    endTime: seg.end,
    viralityScore: seg.viralityScore,
    status: 'pending' as const,
    selected: index === 0,
    createdAt: now,
    updatedAt: now,
  }))

  await col.insertMany(docs)
  return docs
}

export async function updateClipRenderState(params: {
  clipId: string
  shotstackJobId?: string
  finalVideoUrl?: string
  finalR2Key?: string
  status?: ClipEditorClipStatus
}): Promise<void> {
  const db = await clientPromise
  const patch: Partial<ClipEditorClipDocument> = {
    updatedAt: new Date().toISOString(),
  }
  if (params.shotstackJobId) patch.shotstackJobId = params.shotstackJobId
  if (params.finalVideoUrl) patch.finalVideoUrl = params.finalVideoUrl
  if (params.finalR2Key) patch.finalR2Key = params.finalR2Key
  if (params.status) patch.status = params.status
  await db.db('sdhq').collection(CLIPS).updateOne({ _id: params.clipId }, { $set: patch })
}

export async function listClipsForJob(jobId: string): Promise<ClipEditorClipDocument[]> {
  const db = await clientPromise
  return db
    .db('sdhq')
    .collection<ClipEditorClipDocument>(CLIPS)
    .find({ jobId })
    .sort({ viralityScore: -1 })
    .toArray()
}

export async function markSelectedClipComplete(params: {
  jobId: string
  shotstackJobId: string
  finalVideoUrl: string
  finalR2Key?: string
}): Promise<void> {
  const db = await clientPromise
  const col = db.db('sdhq').collection<ClipEditorClipDocument>(CLIPS)
  const selected = await col.findOne({ jobId: params.jobId, selected: true })
  if (!selected) return
  await col.updateOne(
    { _id: selected._id },
    {
      $set: {
        shotstackJobId: params.shotstackJobId,
        finalVideoUrl: params.finalVideoUrl,
        finalR2Key: params.finalR2Key,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
    }
  )
}
