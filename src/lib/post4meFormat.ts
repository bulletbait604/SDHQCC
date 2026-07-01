import {
  formatYouTubeTagsForCopy,
  isYouTubeClipPlatform,
  stripHashtagsFromDescription,
  type NormalizedClipMetadata,
} from '@/lib/clipAnalyzerMetadata'
import { buildCombinedPostCaption } from '@/lib/post4meCaption'
import type { Post4MeResult } from '@/lib/post4meGenerate'

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

export type Post4MePlatformOutput = {
  platformId: string
  platformName: string
  isYouTube: boolean
  title?: string
  titles: string[]
  description: string
  tags: string[]
  combinedCaption?: string
  youtubeTagsCopy?: string
  youtubeDescription?: string
  viralityScore?: number
  viralitySummary?: string
}

export function platformDisplayName(platformId: string): string {
  return PLATFORM_LABELS[platformId] || platformId
}

export function buildPost4MePlatformOutput(
  platformId: string,
  meta: NormalizedClipMetadata & {
    viralityScore?: number
    viralitySummary?: string
  }
): Post4MePlatformOutput {
  const isYouTube = isYouTubeClipPlatform(platformId)
  const youtubeTagsCopy = isYouTube ? formatYouTubeTagsForCopy(meta.tags) : undefined
  const youtubeDescription = isYouTube
    ? stripHashtagsFromDescription(meta.description.replace(/<[^>]*>/g, ''))
    : undefined
  const combinedCaption = isYouTube ? undefined : buildCombinedPostCaption(meta)

  return {
    platformId,
    platformName: platformDisplayName(platformId),
    isYouTube,
    title: meta.title,
    titles: meta.titles,
    description: meta.description,
    tags: meta.tags,
    combinedCaption,
    youtubeTagsCopy,
    youtubeDescription,
    viralityScore: meta.viralityScore,
    viralitySummary: meta.viralitySummary,
  }
}

export function buildPost4MePlatformOutputs(
  results: Post4MeResult[]
): Post4MePlatformOutput[] {
  return results.map((r) =>
    buildPost4MePlatformOutput(r.platformId, {
      titles: r.titles,
      title: r.title,
      description: r.description,
      tags: r.tags,
      viralityScore: r.viralityScore,
      viralitySummary: r.viralitySummary,
    })
  )
}

export const POST4ME_MAX_PLATFORMS = 5

export const VALID_POST4ME_PLATFORM_IDS = new Set([
  'tiktok',
  'instagram',
  'youtube-shorts',
  'youtube-long',
  'facebook-reels',
])

export function normalizePost4MePlatformIds(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? [input] : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim().toLowerCase()
    if (!VALID_POST4ME_PLATFORM_IDS.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= POST4ME_MAX_PLATFORMS) break
  }
  return out
}
