import type { Platform } from '@/lib/home/types'

export const DEFAULT_PLATFORMS: Platform[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    image: 'https://iili.io/Bep916P.webp',
    data: null,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    image: 'https://iili.io/BepIskv.png',
    data: null,
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    image: 'https://iili.io/Bep23il.webp',
    data: null,
  },
  {
    id: 'youtube-long',
    name: 'YouTube Long',
    image: 'https://iili.io/Bep23il.webp',
    data: null,
  },
  {
    id: 'facebook-reels',
    name: 'Facebook Reels',
    image: 'https://iili.io/Bepazil.png',
    data: null,
  },
]

export function platformsBannerLogos(platforms: Platform[]): Platform[] {
  return platforms.filter((p) => p.id !== 'youtube-long')
}
