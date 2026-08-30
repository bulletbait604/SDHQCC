import { randomUUID } from 'crypto'
import clientPromise from '@/lib/mongodb'

export type ViralClipJobStatus =
  | 'preparing'
  | 'generating'
  | 'rendering'
  | 'complete'
  | 'failed'

export type ViralClipFalSegment = {
  requestId: string
  model: string
  duration: number
  videoUrl: string
}

export type ViralClipJob = {
  id: string
  userId: string
  username: string
  originalPrompt: string
  generatedPrompt: string
  referenceCount: number
  referenceNotes: string
  duration: number
  model: string
  status: ViralClipJobStatus
  videoKey: string
  videoUrl: string
  creditCost: number
  error: string
  falSegments: ViralClipFalSegment[]
  shotstackRenderId: string
  refunded: boolean
  createdAt: string
  updatedAt: string
}

const COLLECTION = 'viralClipGenJobs'

function col() {
  return clientPromise.then((c) => c.db('sdhq').collection(COLLECTION))
}

function mapJob(r: Record<string, unknown>): ViralClipJob {
  const falRaw = Array.isArray(r.falSegments) ? r.falSegments : []
  return {
    id: String(r.id || r._id),
    userId: String(r.userId || ''),
    username: String(r.username || ''),
    originalPrompt: String(r.originalPrompt || ''),
    generatedPrompt: String(r.generatedPrompt || ''),
    referenceCount: Number(r.referenceCount || 0),
    referenceNotes: String(r.referenceNotes || ''),
    duration: Number(r.duration || 0),
    model: String(r.model || ''),
    status: (r.status as ViralClipJobStatus) || 'failed',
    videoKey: String(r.videoKey || ''),
    videoUrl: String(r.videoUrl || ''),
    creditCost: Number(r.creditCost || 0),
    error: String(r.error || ''),
    falSegments: falRaw.map((item) => {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        requestId: String(rec.requestId || ''),
        model: String(rec.model || ''),
        duration: Number(rec.duration || 0),
        videoUrl: String(rec.videoUrl || ''),
      }
    }),
    shotstackRenderId: String(r.shotstackRenderId || ''),
    refunded: Boolean(r.refunded),
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
  }
}

export async function createViralClipJob(doc: ViralClipJob): Promise<void> {
  await (await col()).insertOne({ ...doc })
}

export async function updateViralClipJob(
  id: string,
  patch: Partial<ViralClipJob>
): Promise<void> {
  await (await col()).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } }
  )
}

export async function claimViralClipJobStatus(
  id: string,
  from: ViralClipJobStatus,
  to: ViralClipJobStatus
): Promise<boolean> {
  const result = await (await col()).updateOne(
    { id, status: from },
    { $set: { status: to, updatedAt: new Date().toISOString() } }
  )
  return (result.modifiedCount || 0) > 0
}

export async function getViralClipJobForUser(
  id: string,
  username: string
): Promise<ViralClipJob | null> {
  const row = await (await col()).findOne({ id, username: username.toLowerCase() })
  if (!row) return null
  return mapJob(row as Record<string, unknown>)
}

export async function listViralClipJobsForUser(
  username: string,
  limit = 20
): Promise<ViralClipJob[]> {
  const rows = await (await col())
    .find({ username: username.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return rows.map((r) => mapJob(r as Record<string, unknown>))
}

export function newViralClipJobId(): string {
  return randomUUID()
}
