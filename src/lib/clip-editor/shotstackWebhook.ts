import clientPromise from '@/lib/mongodb'
import { scheduleClipEditorStep } from '@/lib/clip-editor/dispatch'
import type { ClipEditorJobDocument } from '@/lib/clip-editor/types'

export async function findClipEditorJobByShotstackRenderId(
  renderId: string
): Promise<ClipEditorJobDocument | null> {
  const db = await clientPromise
  const col = db.db('sdhq').collection('clipEditorJobs')
  const row = await col.findOne({
    $or: [
      { shotstackRenderId: renderId },
      { cutShotstackRenderId: renderId },
      { effectsShotstackRenderId: renderId },
    ],
  })
  return row ? (row as unknown as ClipEditorJobDocument) : null
}

/** Handle Shotstack webhook callback — nudge QStash worker to poll/finalize. */
export async function handleShotstackWebhook(payload: {
  id?: string
  status?: string
  url?: string
}): Promise<{ ok: boolean; jobId?: string; scheduled?: boolean }> {
  const renderId = typeof payload.id === 'string' ? payload.id : ''
  if (!renderId) return { ok: false }

  const status = String(payload.status || '').toUpperCase()
  const job = await findClipEditorJobByShotstackRenderId(renderId)
  if (!job) return { ok: true }

  if (status === 'DONE' || status === 'COMPLETED' || status === 'FAILED') {
    await scheduleClipEditorStep(job._id, 1)
    return { ok: true, jobId: job._id, scheduled: true }
  }

  return { ok: true, jobId: job._id, scheduled: false }
}
