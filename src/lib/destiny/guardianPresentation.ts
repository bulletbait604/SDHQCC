/**
 * Live guardian presentation from Bungie Profile API.
 * Components: 100 Profiles, 200 Characters, 205 CharacterEquipment
 */

import { getPlayerProfile } from '@/lib/destiny/bungieClient'
import { buildBungieIconUrl } from '@/lib/destiny/bungieUrls'
import { resolveInventoryItem } from '@/lib/destiny/manifest'
import type { DestinyCharacterClass } from '@/lib/destiny/types'

const CLASS_MAP: Record<number, DestinyCharacterClass> = {
  0: 'titan',
  1: 'hunter',
  2: 'warlock',
}

const HELMET_BUCKET = 3448274439

export interface GuardianPresentation {
  displayName?: string
  guardianRank: number
  powerLevel: number
  characterClass: DestinyCharacterClass
  characterId: string
  emblemUrl?: string
  emblemBackgroundUrl?: string
  emblemColor?: string
  characterThumbnailUrl?: string
}

export interface CharacterPresentation {
  characterId: string
  characterClass: DestinyCharacterClass
  powerLevel: number
  emblemUrl?: string
  emblemBackgroundUrl?: string
  emblemColor?: string
}

function emblemColorCss(color?: { red?: number; green?: number; blue?: number; alpha?: number }): string | undefined {
  if (!color) return undefined
  const r = color.red ?? 0
  const g = color.green ?? 0
  const b = color.blue ?? 0
  const a = (color.alpha ?? 255) / 255
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export async function fetchGuardianPresentation(
  membershipType: number,
  membershipId: string,
  accessToken: string,
  fallbackDisplayName?: string,
  preferredCharacterId?: string
): Promise<GuardianPresentation | null> {
  const profile = (await getPlayerProfile(
    membershipType,
    membershipId,
    [100, 200, 205],
    accessToken
  )) as {
    profile?: { data?: { displayName?: string; currentGuardianRank?: number } }
    characters?: {
      data?: Record<
        string,
        {
          classType?: number
          light?: number
          emblemPath?: string
          emblemBackgroundPath?: string
          emblemColor?: { red?: number; green?: number; blue?: number; alpha?: number }
        }
      >
    }
    characterEquipment?: {
      data?: Record<string, { items?: Array<{ itemHash?: number; bucketHash?: number }> }>
    }
  }

  const chars = profile.characters?.data ?? {}
  const bestEntry =
    preferredCharacterId && chars[preferredCharacterId]
      ? ([preferredCharacterId, chars[preferredCharacterId]] as const)
      : Object.entries(chars).sort(([, a], [, b]) => (b.light ?? 0) - (a.light ?? 0))[0]
  if (!bestEntry) return null

  const [characterId, character] = bestEntry
  const classType = character.classType ?? 1
  const characterClass = CLASS_MAP[classType] ?? 'hunter'

  const equipment = profile.characterEquipment?.data?.[characterId]?.items ?? []
  const helmet = equipment.find((i) => i.bucketHash === HELMET_BUCKET && i.itemHash)
  let characterThumbnailUrl: string | undefined
  if (helmet?.itemHash) {
    try {
      const item = await resolveInventoryItem(helmet.itemHash)
      characterThumbnailUrl = item.iconUrl
    } catch {
      /* optional thumbnail */
    }
  }

  return {
    displayName: profile.profile?.data?.displayName ?? fallbackDisplayName,
    guardianRank: profile.profile?.data?.currentGuardianRank ?? 0,
    powerLevel: character.light ?? 0,
    characterClass,
    characterId,
    emblemUrl: buildBungieIconUrl(character.emblemPath),
    emblemBackgroundUrl: buildBungieIconUrl(character.emblemBackgroundPath),
    emblemColor: emblemColorCss(character.emblemColor),
    characterThumbnailUrl,
  }
}

type BungieCharacterRecord = {
  classType?: number
  light?: number
  emblemPath?: string
  emblemBackgroundPath?: string
  emblemColor?: { red?: number; green?: number; blue?: number; alpha?: number }
}

function mapCharacterRecord(
  characterId: string,
  character: BungieCharacterRecord
): CharacterPresentation {
  const classType = character.classType ?? 1
  return {
    characterId,
    characterClass: CLASS_MAP[classType] ?? 'hunter',
    powerLevel: character.light ?? 0,
    emblemUrl: buildBungieIconUrl(character.emblemPath),
    emblemBackgroundUrl: buildBungieIconUrl(character.emblemBackgroundPath),
    emblemColor: emblemColorCss(character.emblemColor),
  }
}

/** All characters for DIM-style header tiles (component 200). */
export async function fetchAllCharactersPresentation(
  membershipType: number,
  membershipId: string,
  accessToken: string
): Promise<CharacterPresentation[]> {
  const profile = (await getPlayerProfile(membershipType, membershipId, [200], accessToken)) as {
    characters?: { data?: Record<string, BungieCharacterRecord> }
  }

  return Object.entries(profile.characters?.data ?? {})
    .map(([characterId, character]) => mapCharacterRecord(characterId, character))
    .sort((a, b) => b.powerLevel - a.powerLevel)
}
