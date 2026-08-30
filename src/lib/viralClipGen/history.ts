import { randomUUID } from 'crypto'
import clientPromise from '@/lib/mongodb'

export type ViralClipJobStatus =
  | 'preparing'
  | 'generating'
  | 'rendering'
  | 'complete'
  | 'failed'

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
  createdAt: string
  updatedAt: string
}

const COLLECTION = 'viralClipGenJobs'

function col() {
  return clientPromise.then((c) => c.db('sdhq').collection(COLLECTION))
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

export async function listViralClipJobsForUser(
  username: string,
  limit = 20
): Promise<ViralClipJob[]> {
  const rows = await (await col())
    .find({ username: username.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return rows.map((r) => ({
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
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
  }))
}

export function newViralClipJobId(): string {
  return randomUUID()
}
