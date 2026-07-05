/**
 * Parse live character build from Bungie (subclass, aspects, fragments, abilities, armor stats).
 */

import { getCharacterLoadout } from '@/lib/destiny/bungieClient'
import { buildBungieIconUrl } from '@/lib/destiny/bungieUrls'
import { resolveInventoryItem, type ManifestDefinitionInfo } from '@/lib/destiny/manifest'
import type { BuildSnapshot, DestinyCharacterClass, DestinyIconRef } from '@/lib/destiny/types'

const CLASS_MAP: Record<number, DestinyCharacterClass> = {
  0: 'titan',
  1: 'hunter',
  2: 'warlock',
}

const WEAPON_BUCKETS: Record<number, 'kinetic' | 'energy' | 'power'> = {
  1498876634: 'kinetic',
  2465295065: 'energy',
  953998645: 'power',
}

const SUBCLASS_BUCKET = 3284755031
const ARMOR_BUCKETS = new Set([14239492, 20886954, 1585787867, 3551918588])

const STAT_HASH_LABEL: Record<number, string> = {
  2996146975: 'Mobility',
  392767087: 'Resilience',
  1943323491: 'Recovery',
  1735777505: 'Discipline',
  144602215: 'Intellect',
  4244567218: 'Strength',
}

type PlugCategory = 'super' | 'class' | 'jump' | 'melee' | 'grenade' | 'aspect' | 'fragment' | 'other'

function iconRefFromInfo(info: ManifestDefinitionInfo): DestinyIconRef {
  return {
    name: info.name,
    hash: info.hash,
    iconUrl: info.iconUrl,
    tierLabel: info.tierLabel,
    entityType: 'DestinyInventoryItemDefinition',
  }
}

function categorizePlug(info: ManifestDefinitionInfo): PlugCategory {
  const type = (info.itemTypeDisplayName ?? '').toLowerCase()
  const name = info.name.toLowerCase()
  if (type.includes('super') || /\bsuper\b/.test(name)) return 'super'
  if (type.includes('aspect') || name.includes('aspect')) return 'aspect'
  if (type.includes('fragment') || name.includes('fragment')) return 'fragment'
  if (type.includes('melee') || type.includes('melee ability')) return 'melee'
  if (type.includes('grenade') || type.includes('grenade ability')) return 'grenade'
  if (
    type.includes('class ability') ||
    type.includes('barricade') ||
    type.includes('rift') ||
    type.includes('dodge')
  ) {
    return 'class'
  }
  if (
    type.includes('movement') ||
    type.includes('jump') ||
    type.includes('lift') ||
    type.includes('glide') ||
    type.includes('stride')
  ) {
    return 'jump'
  }
  if (/barricade|rift|dodge|sentinel shield|healing rift/i.test(name)) return 'class'
  if (/hammer|knife|palm|staff|axe|glaive|throwing knife/i.test(name)) return 'melee'
  if (/grenade|flashbang|tripmine|incendiary|vortex|void wall|duskfield|storm/i.test(name)) return 'grenade'
  if (/high lift|strafe|triple|burst|balanced|strafe glide|controlled/i.test(name)) return 'jump'
  return 'other'
}

async function resolvePlug(plugHash: number): Promise<{ ref: DestinyIconRef; category: PlugCategory }> {
  const info = await resolveInventoryItem(plugHash, 'Ability')
  return { ref: iconRefFromInfo(info), category: categorizePlug(info) }
}

export async function fetchCharacterBuild(
  membershipType: number,
  membershipId: string,
  accessToken: string,
  userId: string,
  preferredCharacterId?: string
): Promise<BuildSnapshot | null> {
  const profile = (await getCharacterLoadout(
    membershipType,
    membershipId,
    preferredCharacterId ?? '',
    accessToken
  )) as {
    characters?: { data?: Record<string, { classType?: number; light?: number }> }
    characterEquipment?: {
      data?: Record<string, { items?: Array<{ itemHash?: number; bucketHash?: number; itemInstanceId?: string }> }>
    }
    itemComponents?: {
      stats?: {
        data?: Record<string, { stats?: Record<string, { value?: number }> }>
      }
      sockets?: {
        data?: Record<
          string,
          { sockets?: Array<{ plugHash?: number; isEnabled?: boolean; isVisible?: boolean }> }
        >
      }
    }
  }

  const chars = profile.characters?.data ?? {}
  const characterId =
    preferredCharacterId && chars[preferredCharacterId]
      ? preferredCharacterId
      : Object.entries(chars).sort(([, a], [, b]) => (b.light ?? 0) - (a.light ?? 0))[0]?.[0]

  if (!characterId) return null

  const classType = chars[characterId]?.classType ?? 1
  const characterClass = CLASS_MAP[classType] ?? 'hunter'

  const items = profile.characterEquipment?.data?.[characterId]?.items ?? []
  const weapons: Record<string, string> = {}
  let exoticArmor = '—'
  let exoticWeapon: string | undefined
  let subclass = 'Subclass'
  let subclassRef: DestinyIconRef | undefined
  const aspects: string[] = []
  const aspectRefs: DestinyIconRef[] = []
  const fragments: string[] = []
  const fragmentRefs: DestinyIconRef[] = []
  const plugsByCategory: Partial<Record<PlugCategory, DestinyIconRef>> = {}
  const stats: Record<string, number> = {}

  for (const item of items) {
    if (!item.itemHash || !item.bucketHash) continue
    const itemInfo = await resolveInventoryItem(item.itemHash, `Item ${item.itemHash}`)
    const name = itemInfo.name
    const bucket = item.bucketHash

    if (bucket === SUBCLASS_BUCKET) {
      subclass = name
      subclassRef = iconRefFromInfo(itemInfo)

      const socketRow = profile.itemComponents?.sockets?.data?.[item.itemInstanceId ?? '']
      const sockets = socketRow?.sockets ?? []
      for (const socket of sockets) {
        if (!socket.plugHash) continue
        const { ref, category } = await resolvePlug(socket.plugHash)
        if (category === 'aspect') {
          const clean = ref.name.replace(/ aspect$/i, '')
          aspects.push(clean)
          aspectRefs.push({ ...ref, name: clean })
        } else if (category === 'fragment') {
          const clean = ref.name.replace(/ fragment$/i, '')
          fragments.push(clean)
          fragmentRefs.push({ ...ref, name: clean })
        } else if (category !== 'other' && !plugsByCategory[category]) {
          plugsByCategory[category] = ref
        }
      }
    } else if (WEAPON_BUCKETS[bucket]) {
      weapons[WEAPON_BUCKETS[bucket]] = name
      if (bucket === 953998645) exoticWeapon = name
    } else if (ARMOR_BUCKETS.has(bucket)) {
      if (name.toLowerCase().includes('exotic') || exoticArmor === '—') exoticArmor = name
      const statRow = profile.itemComponents?.stats?.data?.[item.itemInstanceId ?? '']
      if (statRow?.stats) {
        for (const [hash, val] of Object.entries(statRow.stats)) {
          const label = STAT_HASH_LABEL[Number(hash)] ?? hash
          stats[label] = (stats[label] ?? 0) + (val.value ?? 0)
        }
      }
    }
  }

  const superRef = plugsByCategory.super
  const classAbilityRef = plugsByCategory.class
  const jumpRef = plugsByCategory.jump
  const meleeRef = plugsByCategory.melee
  const grenadeRef = plugsByCategory.grenade

  const superAbility = superRef?.name ?? '—'
  const classAbility = classAbilityRef?.name ?? '—'
  const jump = jumpRef?.name ?? '—'
  const melee = meleeRef?.name ?? '—'
  const grenade = grenadeRef?.name ?? '—'

  return {
    id: `live-${characterId}`,
    runId: '',
    userId,
    characterClass,
    subclass,
    super: superAbility,
    aspects: aspects.slice(0, 2),
    fragments: fragments.slice(0, 5),
    abilities: [superAbility, classAbility, jump, melee, grenade].filter((a) => a !== '—'),
    exoticArmor,
    exoticWeapon,
    kineticWeapon: weapons.kinetic ?? '—',
    energyWeapon: weapons.energy ?? '—',
    powerWeapon: weapons.power ?? '—',
    armorMods: [],
    artifactPerks: [],
    stats,
    activityId: 0,
    activityName: 'Current build',
    difficulty: 'normal',
    completedAt: new Date().toISOString(),
    durationSeconds: 0,
    deaths: 0,
    fireteamComposition: 'solo',
    subclassRef,
    aspectRefs,
    fragmentRefs,
    superRef,
    classAbilityRef,
    jumpRef,
    meleeRef,
    grenadeRef,
  }
}

/** Resolve emblem URLs for the active character from a profile payload. */
export function emblemUrlsFromProfile(
  profile: {
    characters?: {
      data?: Record<
        string,
        {
          light?: number
          emblemPath?: string
          emblemBackgroundPath?: string
          emblemColor?: { red?: number; green?: number; blue?: number; alpha?: number }
        }
      >
    }
  },
  characterId: string
): { emblemUrl?: string; emblemBackgroundUrl?: string; emblemColor?: string } {
  const character = profile.characters?.data?.[characterId]
  if (!character) return {}
  const emblemColor = character.emblemColor
    ? `rgba(${character.emblemColor.red ?? 0}, ${character.emblemColor.green ?? 0}, ${character.emblemColor.blue ?? 0}, ${(character.emblemColor.alpha ?? 255) / 255})`
    : undefined
  return {
    emblemUrl: buildBungieIconUrl(character.emblemPath),
    emblemBackgroundUrl: buildBungieIconUrl(character.emblemBackgroundPath),
    emblemColor,
  }
}
