/**
 * Shared live algorithm snapshot formatting for Post4Me, Clip Analyzer, etc.
 */
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { normalizeAlgorithmPlatformData } from '@/lib/algorithmPlatformNormalize'

const LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

/** Map tool platform ids → algorithm snapshot keys. */
export function toAlgorithmPlatformId(platformId: string): string {
  const p = platformId.trim().toLowerCase()
  if (p === 'youtube' || p === 'shorts' || p === 'youtube-shorts') return 'youtube-shorts'
  if (p === 'youtube-long' || p === 'yt-long') return 'youtube-long'
  if (p === 'reels' || p === 'instagram' || p === 'instagram-reels') return 'instagram'
  if (p === 'facebook' || p === 'facebook-reels' || p === 'fb-reels') return 'facebook-reels'
  if (p === 'tiktok') return 'tiktok'
  return p
}

export async function formatAlgorithmContextForPlatform(platformId: string): Promise<{
  algorithmPlatformId: string
  lastUpdated: string | null
  block: string
}> {
  const algorithmPlatformId = toAlgorithmPlatformId(platformId)
  const label = LABEL[algorithmPlatformId] || algorithmPlatformId
  try {
    const snapshot = await readAlgorithmSnapshotFromMongo()
    if (!snapshot?.data || typeof snapshot.data !== 'object') {
      return {
        algorithmPlatformId,
        lastUpdated: null,
        block: `**${label} algorithm snapshot:** unavailable — use general 2026 best practices.`,
      }
    }

    const entry = snapshot.data[algorithmPlatformId]
    const rec = normalizeAlgorithmPlatformData(entry)
    if (!rec) {
      return {
        algorithmPlatformId,
        lastUpdated: snapshot.lastUpdated,
        block: `**${label} algorithm snapshot:** no entry yet (last global update: ${snapshot.lastUpdated || 'unknown'}).`,
      }
    }

    const summaries = rec.summaries.slice(0, 6)
    const parts = [
      `**${label} LIVE algorithm snapshot** (updated ${snapshot.lastUpdated || 'unknown'}):`,
      summaries.length ? `Insights: ${summaries.join(' | ')}` : '',
      rec.keyChanges ? `Ranking / key changes: ${rec.keyChanges.slice(0, 500)}` : '',
      rec.editingTips ? `Editing tips: ${rec.editingTips.slice(0, 400)}` : '',
      rec.postingTips ? `Posting tips (times/frequency): ${rec.postingTips.slice(0, 400)}` : '',
      rec.titleTips ? `Title/hook tips: ${rec.titleTips.slice(0, 300)}` : '',
      rec.descriptionTips ? `Caption/description tips: ${rec.descriptionTips.slice(0, 300)}` : '',
    ].filter(Boolean)

    return {
      algorithmPlatformId,
      lastUpdated: snapshot.lastUpdated,
      block: parts.join('\n'),
    }
  } catch (error) {
    console.warn('[algorithmContext] Failed to load snapshot:', error)
    return {
      algorithmPlatformId,
      lastUpdated: null,
      block: `**${label} algorithm snapshot:** temporarily unavailable — use general 2026 best practices.`,
    }
  }
}
