import { randomUUID } from 'crypto'
import clientPromise from '@/lib/mongodb'
import type { ClipEditorJobDocument, ClipEditorJobPasses, CreateClipEditorJobBody } from '@/lib/clip-editor/types'
import type { ClipEditorJobState } from '@/lib/clip-editor/jobStates'
import { CLIP_EDITOR_STATE_PROGRESS } from '@/lib/clip-editor/jobStates'

const COLLECTION = 'clipEditorJobs'

function collection() {
  return clientPromise.then((client) => client.db('sdhq').collection(COLLECTION))
}

export async function createClipEditorJob(params: {
  userId: string
  username: string
  sourceReadUrl: string
  body: CreateClipEditorJobBody
}): Promise<ClipEditorJobDocument> {
  const now = new Date().toISOString()
  const doc: ClipEditorJobDocument = {
    _id: randomUUID(),
    userId: params.userId,
    username: params.username,
    r2FileKey: params.body.r2FileKey,
    sourceReadUrl: params.sourceReadUrl,
    platform: params.body.platform,
    layoutTemplate: params.body.layoutTemplate,
    landscapeMode: params.body.landscapeMode,
    sourceDurationSeconds: params.body.sourceDurationSeconds,
    mimeType: params.body.mimeType || 'video/mp4',
    state: 'UPLOADED',
    progress: CLIP_EDITOR_STATE_PROGRESS.UPLOADED,
    passes: {},
    createdAt: now,
    updatedAt: now,
  }
  const col = await collection()
  await col.insertOne(doc as import('mongodb').Document)
  return doc
}

export async function getClipEditorJob(jobId: string): Promise<ClipEditorJobDocument | null> {
  const col = await collection()
  const row = await col.findOne({ _id: jobId })
  if (!row) return null
  return row as unknown as ClipEditorJobDocument
}

export async function getClipEditorJobForUser(
  jobId: string,
  username: string
): Promise<ClipEditorJobDocument | null> {
  const col = await collection()
  const normalized = username.replace(/^@/, '').toLowerCase()
  const row = await col.findOne({ _id: jobId, username: normalized })
  if (!row) return null
  return row as unknown as ClipEditorJobDocument
}

export async function updateClipEditorJobState(
  jobId: string,
  state: ClipEditorJobState,
  patch?: Partial<Pick<ClipEditorJobDocument, 'error' | 'shotstackRenderId' | 'outputR2Key' | 'outputUrl'>>
): Promise<void> {
  const col = await collection()
  await col.updateOne(
    { _id: jobId },
    {
      $set: {
        state,
        progress: CLIP_EDITOR_STATE_PROGRESS[state],
        updatedAt: new Date().toISOString(),
        ...patch,
      },
    }
  )
}

export async function updateClipEditorJobPasses(
  jobId: string,
  passes: Partial<ClipEditorJobPasses>
): Promise<void> {
  const col = await collection()
  const setFields: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const [key, value] of Object.entries(passes)) {
    if (value !== undefined) setFields[`passes.${key}`] = value
  }
  await col.updateOne({ _id: jobId }, { $set: setFields })
}

export async function markClipEditorJobFailed(jobId: string, error: string): Promise<void> {
  await updateClipEditorJobState(jobId, 'FAILED', { error })
}

export async function markClipEditorJobComplete(
  jobId: string,
  output: { outputUrl: string; outputR2Key?: string; shotstackRenderId?: string }
): Promise<void> {
  await updateClipEditorJobState(jobId, 'COMPLETE', output)
}
