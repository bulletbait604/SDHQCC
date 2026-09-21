import type { ExtractedSocial } from '@/lib/kick/extractSocials'

export type ChannelInsights = {
  streamerBackground: string
  gameStyles: string
  favoriteGames: string[]
  schedule: string
  socials: ExtractedSocial[]
  sourceNotes: string
}
