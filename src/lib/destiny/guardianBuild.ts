/**
 * Parse live character build from Bungie (subclass, aspects, fragments, abilities, armor stats).
 */

import { getCharacterLoadout, getPlayerProfile } from '@/lib/destiny/bungieClient'
import { resolveInventoryItem } from '@/lib/destiny/manifest'
import type { BuildSnapshot, DestinyCharacterClass } from '@/lib/destiny/types'

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
const ASPECT_BUCKET = 2395679864
const FRAGMENT_BUCKET = 227512782
const ARMOR_BUCKETS = new Set([14239492, 20886954, 1585787867, 3551918588, 14239492])

const STAT_HASH_LABEL: Record<number, string> = {
  2996146975: 'Mobility',
  392767087: 'Resilience',
  1943323491: 'Recovery',
  1735777505: 'Discipline',
  144602215: 'Intellect',
  4244567218: 'Strength',
}

async function resolveItemName(hash: number, fallback: string): Promise<string> {
  const info = await resolveInventoryItem(hash, fallback)
  return info.name
}

export async function fetchCharacterBuild(
  membershipType: number,
  membershipId: string,
  accessToken: string,
  userId: string,
  preferredCharacterId?: string
): Promise<BuildSnapshot | null> {
  const profile = (await getPlayerProfile(membershipType, membershipId, [200], accessToken)) as {
    characters?: { data?: Record<string, { classType?: number; light?: number }> }
  }

  const chars = profile.characters?.data ?? {}
  const characterId =
    preferredCharacterId && chars[preferredCharacterId]
      ? preferredCharacterId
      : Object.entries(chars).sort(([, a], [, b]) => (b.light ?? 0) - (a.light ?? 0))[0]?.[0]

  if (!characterId) return null

  const classType = chars[characterId]?.classType ?? 1
  const characterClass = CLASS_MAP[classType] ?? 'hunter'

  const loadout = (await getCharacterLoadout(
    membershipType,
    membershipId,
    characterId,
    accessToken
  )) as {
    equipment?: { data?: { items?: Array<{ itemHash?: number; bucketHash?: number; itemInstanceId?: string }> } }
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

  const items = loadout.equipment?.data?.items ?? []
  const weapons: Record<string, string> = {}
  let exoticArmor = '—'
  let exoticWeapon: string | undefined
  let subclass = 'Subclass'
  const aspects: string[] = []
  const fragments: string[] = []
  const abilities: string[] = []
  const stats: Record<string, number> = {}

  for (const item of items) {
    if (!item.itemHash || !item.bucketHash) continue
    const name = await resolveItemName(item.itemHash, `Item ${item.itemHash}`)
    const bucket = item.bucketHash

    if (bucket === SUBCLASS_BUCKET) {
      subclass = name
      const socketRow = loadout.itemComponents?.sockets?.data?.[item.itemInstanceId ?? '']
      const sockets = socketRow?.sockets ?? []
      if (sockets.length) {
        for (const socket of sockets) {
          if (!socket.isEnabled || !socket.plugHash) continue
          const plugName = await resolveItemName(socket.plugHash, 'Ability')
          if (plugName.toLowerCase().includes('aspect')) {
            aspects.push(plugName.replace(/ aspect$/i, ''))
          } else if (plugName.toLowerCase().includes('fragment')) {
            fragments.push(plugName.replace(/ fragment$/i, ''))
          } else if (
            plugName.toLowerCase().includes('super') ||
            abilities.length === 0
          ) {
            if (plugName.toLowerCase().includes('super')) {
              abilities[0] = plugName
            } else if (!abilities.includes(plugName)) {
              abilities.push(plugName)
            }
          }
        }
      }
    } else if (bucket === ASPECT_BUCKET) {
      aspects.push(name.replace(/ aspect$/i, ''))
    } else if (bucket === FRAGMENT_BUCKET) {
      fragments.push(name.replace(/ fragment$/i, ''))
    } else if (WEAPON_BUCKETS[bucket]) {
      weapons[WEAPON_BUCKETS[bucket]] = name
      if (bucket === 953998645) exoticWeapon = name
    } else if (ARMOR_BUCKETS.has(bucket) || [3551918588].includes(bucket)) {
      if (name.toLowerCase().includes('exotic') || exoticArmor === '—') exoticArmor = name
      const statRow = loadout.itemComponents?.stats?.data?.[item.itemInstanceId ?? '']
      if (statRow?.stats) {
        for (const [hash, val] of Object.entries(statRow.stats)) {
          const label = STAT_HASH_LABEL[Number(hash)] ?? hash
          stats[label] = (stats[label] ?? 0) + (val.value ?? 0)
        }
      }
    }
  }

  const superAbility = abilities.find((a) => a.toLowerCase().includes('super')) ?? abilities[0] ?? '—'
  const classAbility = abilities.find((a) => /class|barricade|rift|dodge/i.test(a)) ?? '—'
  const melee = abilities.find((a) => /melee|hammer|knife|palm/i.test(a)) ?? '—'
  const grenade = abilities.find((a) => /grenade|nade|bolt|wall/i.test(a)) ?? '—'
  const jump = abilities.find((a) => /jump|lift|glide/i.test(a)) ?? '—'

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
  }
}
