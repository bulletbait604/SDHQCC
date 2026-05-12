import type { AlgorithmSnapshotPayload } from '@/lib/algorithmSnapshotRead'
import type { TargetPlatform } from '@/lib/platformEditing'

type AlgorithmSource = {
  id: string
  label: string
}

export type ClipEditorAlgorithmNotes = {
  targetPlatform: TargetPlatform
  sources: Array<AlgorithmSource & { notes: unknown }>
  lastUpdated: string | null
  provider?: string
}

const CLIP_PLATFORM_ALGORITHM_SOURCES: Record<TargetPlatform, AlgorithmSource[]> = {
  tiktok: [{ id: 'tiktok', label: 'TikTok' }],
  youtube: [
    { id: 'youtube-shorts', label: 'YouTube Shorts' },
    { id: 'youtube-long', label: 'YouTube Long' },
  ],
  reels: [
    { id: 'instagram', label: 'Instagram Reels' },
    { id: 'facebook-reels', label: 'Facebook Reels' },
  ],
}

export function resolveClipEditorAlgorithmNotes(
  snapshot: AlgorithmSnapshotPayload | null,
  platform: TargetPlatform
): ClipEditorAlgorithmNotes | null {
  if (!snapshot?.data || typeof snapshot.data !== 'object') return null

  const sources: Array<AlgorithmSource & { notes: unknown }> = []
  for (const source of CLIP_PLATFORM_ALGORITHM_SOURCES[platform]) {
    const notes = snapshot.data[source.id]
    if (notes == null) continue
    sources.push({ ...source, notes })
  }

  if (sources.length === 0) return null

  return {
    targetPlatform: platform,
    sources,
    lastUpdated: snapshot.lastUpdated,
    provider: snapshot.provider,
  }
}

export function summarizeClipEditorAlgorithmSources(notes: ClipEditorAlgorithmNotes | null) {
  if (!notes) return null
  return {
    sources: notes.sources.map(({ id, label }) => ({ id, label })),
    lastUpdated: notes.lastUpdated,
    provider: notes.provider,
  }
}
