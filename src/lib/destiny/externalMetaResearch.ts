/**
 * Curated meta builds researched from community build sites.
 * Refreshed on a rolling 4-week window — sources cited with links.
 *
 * Primary references:
 * - https://www.blueberries.gg/armor/best-destiny-2-builds/
 * - https://www.blueberries.gg/armor/destiny-2-hunter-builds/
 * - https://www.blueberries.gg/armor/destiny-2-titan-builds/
 * - https://www.light.gg/loadouts/db/
 * - https://togame.io/a/destiny2-pve-loadout-meta/
 * - https://builders.gg/destiny/dim-builds/
 */

import type { ExternalBuildSource } from '@/lib/destiny/types'

/** Research pass timestamp (update when curating a new batch). */
export const META_BUILD_RESEARCH_DATE = '2026-06-15T12:00:00.000Z'

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

/** Builds validated against external sites during the last 4-week research window. */
export const RESEARCHED_META_BUILDS: ExternalBuildSource[] = [
  {
    id: 'meta-togame-praxic-getaway-warlock',
    title: 'Prismatic Getaway Artist (GM sustain)',
    source: 'togame.io PvE Meta Guide',
    sourceSite: 'togame.io',
    sourceUrl: 'https://togame.io/a/destiny2-pve-loadout-meta/',
    class: 'warlock',
    subclass: 'Prismatic',
    exoticArmor: 'Getaway Artist',
    exoticWeapon: 'Praxic Blade',
    weapons: ['Outbreak Perfected', 'Witherhoard', 'Praxic Blade'],
    activityFocus: 'Grandmaster Nightfalls',
    excelsIn: 'Solo GMs & add-clear',
    summary:
      'June 2026 meta pick: ice turret + Devour loop with Praxic Blade heavy for survivability and passive clear. Cited as the safest Warlock endgame loop.',
    publishedAt: '2026-06-10T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-togame-praxic-stronghold-titan',
    title: 'Praxic Blade Stronghold Tank',
    source: 'togame.io PvE Meta Guide',
    sourceSite: 'togame.io',
    sourceUrl: 'https://togame.io/a/destiny2-pve-loadout-meta/',
    class: 'titan',
    subclass: 'Prismatic',
    exoticArmor: 'Stronghold',
    exoticWeapon: 'Praxic Blade',
    weapons: ['Khvostov 7G-0X', 'Trace Rifle', 'Praxic Blade'],
    activityFocus: 'Raids & dungeons',
    excelsIn: 'Tank DPS & survivability',
    summary:
      'Cross-class Praxic Blade meta paired with Stronghold for infinite block — recommended for raid teams that need a frontline.',
    publishedAt: '2026-06-10T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-togame-combination-blow-hunter',
    title: 'Combination Blow Prismatic Hunter',
    source: 'togame.io PvE Meta Guide',
    sourceSite: 'togame.io',
    sourceUrl: 'https://togame.io/a/destiny2-pve-loadout-meta/',
    class: 'hunter',
    subclass: 'Prismatic',
    exoticArmor: 'Gifted Conviction',
    exoticWeapon: 'Praxic Blade',
    weapons: ['Outbreak Perfected', 'Witherhoard', 'Praxic Blade'],
    activityFocus: 'Endgame PvE',
    excelsIn: 'Melee loop & AoE',
    summary:
      'Tempest Strike + Gambler\'s Dodge Combination Blow loop with Ascension for AoE — top Hunter recommendation alongside Lucky Pants variant.',
    publishedAt: '2026-06-10T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-bb-prismatic-artist-warlock',
    title: 'Prismatic Artist',
    source: 'Blueberries.gg — Best Builds',
    sourceSite: 'blueberries.gg',
    sourceUrl: 'https://www.blueberries.gg/armor/best-destiny-2-builds/',
    class: 'warlock',
    subclass: 'Prismatic',
    exoticArmor: 'Ophidian Aspect',
    weapons: ['Imminence', 'Null Composure', 'Stormchaser'],
    activityFocus: 'Raids & dungeons',
    excelsIn: 'Endgame PvE',
    summary:
      '#1 Warlock PvE build on Blueberries Renegades list — flexible Prismatic kit for expert raids and dungeons.',
    publishedAt: '2026-06-01T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-bb-starfire-warlock',
    title: 'Starfire Protocol Boss Melt',
    source: 'Blueberries.gg — Warlock builds',
    sourceSite: 'blueberries.gg',
    sourceUrl: 'https://www.blueberries.gg/armor/best-destiny-2-builds/',
    class: 'warlock',
    subclass: 'Solar',
    exoticArmor: 'Starfire Protocol',
    exoticWeapon: 'Witherhoard',
    weapons: ['Submission', 'Witherhoard', 'Cataclysmic'],
    activityFocus: 'Raid bosses',
    excelsIn: 'Damage phases',
    summary:
      'Solar fusion grenade spam for raid boss melts — still a top-tier pick for Garden of Salvation and King\'s Fall DPS checks.',
    publishedAt: '2026-06-01T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-bb-come-on-and-slam-titan',
    title: 'Come on and Slam (Wormgod)',
    source: 'Blueberries.gg — Titan builds',
    sourceSite: 'blueberries.gg',
    sourceUrl: 'https://www.blueberries.gg/armor/destiny-2-titan-builds/',
    class: 'titan',
    subclass: 'Prismatic',
    exoticArmor: "Wormgod Caress",
    weapons: ['Imminence', 'Tractor Cannon', 'Sword'],
    activityFocus: 'Raids & dungeons',
    excelsIn: 'Melee DPS',
    summary:
      '#1 Titan PvE build on Blueberries — bonk / slam loop for high burst in expert content.',
    publishedAt: '2026-06-01T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-bb-gift-of-tempest-hunter',
    title: 'Gift of the Tempest',
    source: 'Blueberries.gg — Hunter builds',
    sourceSite: 'blueberries.gg',
    sourceUrl: 'https://www.blueberries.gg/armor/destiny-2-hunter-builds/',
    class: 'hunter',
    subclass: 'Arc',
    exoticArmor: 'Raiden Flux',
    activityFocus: 'Raids',
    excelsIn: 'Arc DPS & add-clear',
    summary:
      '#1 Hunter PvE build — Arc super and ability spam for raid add-clear and boss damage.',
    publishedAt: '2026-06-01T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-bb-transcendent-tank-hunter',
    title: 'The Transcendent Tank',
    source: 'Blueberries.gg — Hunter builds',
    sourceSite: 'blueberries.gg',
    sourceUrl: 'https://www.blueberries.gg/armor/destiny-2-hunter-builds/',
    class: 'hunter',
    subclass: 'Prismatic',
    exoticArmor: 'Gyrfalcon',
    weapons: ['Kinetic primary', 'Void special', 'Heavy GL'],
    activityFocus: 'Grandmaster Nightfalls',
    excelsIn: 'Survivability',
    summary:
      'Top GM Hunter pick — Prismatic sustain with void debuff support for Master content.',
    publishedAt: '2026-06-01T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-lightgg-raid-arc-titan',
    title: 'Raid Arc Thundercrash (high-skill)',
    source: 'light.gg Loadout Database',
    sourceSite: 'light.gg',
    sourceUrl: 'https://www.light.gg/loadouts/db/?activity=raids',
    class: 'titan',
    subclass: 'Arc',
    exoticArmor: 'Cuirass of the Falling Star',
    exoticWeapon: 'Thunderlord',
    weapons: ['Pulse rifle', 'Trace rifle', 'Rocket launcher'],
    activityFocus: 'Raids',
    excelsIn: 'Boss damage phases',
    summary:
      'Popular raid loadout pattern from light.gg high-skill database — Cuirass Thundercrash for burst boss DPS.',
    publishedAt: '2026-06-12T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-builders-cuirass-contest',
    title: 'Contest Raid Arc Titan',
    source: 'builders.gg DIM builds',
    sourceSite: 'builders.gg',
    sourceUrl: 'https://builders.gg/destiny/dim-builds/dn7kvli/raid',
    class: 'titan',
    subclass: 'Arc',
    exoticArmor: 'Cuirass of the Falling Star',
    weapons: ['Arc primary', 'Arc special', 'Arc heavy'],
    activityFocus: 'Contest raids',
    excelsIn: 'Day-one / contest',
    summary:
      'Thundercrash + Cuirass raid build shared via DIM/builders.gg — amplified loop for contest mode clears.',
    publishedAt: '2026-06-08T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-gos-void-warlock-support',
    title: 'Garden of Salvation Well Support',
    source: 'Top Nest research (Blueberries + light.gg)',
    sourceSite: 'top-nest',
    sourceUrl: 'https://www.blueberries.gg/armor/best-destiny-2-builds/',
    class: 'warlock',
    subclass: 'Void',
    exoticArmor: 'Ophidian Aspect',
    exoticWeapon: 'Divinity',
    weapons: ['Supremacy', 'Explosive Personality', 'Zephyr Reward'],
    activityFocus: 'Garden of Salvation',
    excelsIn: 'Featured raid week',
    summary:
      'Featured raid meta: Void well + Divinity support for Garden relay and final encounter teams.',
    publishedAt: '2026-06-16T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
  {
    id: 'meta-kf-star-eater-hunter',
    title: "King's Fall Star-Eater DPS",
    source: 'Top Nest research (Blueberries + togame.io)',
    sourceSite: 'top-nest',
    sourceUrl: 'https://www.blueberries.gg/armor/destiny-2-hunter-builds/',
    class: 'hunter',
    subclass: 'Solar',
    exoticArmor: 'Star-Eater Scales',
    weapons: ['Submission', "Calus's Selected", 'Linear fusion'],
    activityFocus: "King's Fall",
    excelsIn: 'Featured raid week',
    summary:
      'Solar Hunter burst for King\'s Fall damage checks — Star-Eater rocket spam for Warpriest and Oryx phases.',
    publishedAt: '2026-06-16T00:00:00.000Z',
    lastChecked: META_BUILD_RESEARCH_DATE,
    approved: true,
  },
]

export function metaResearchWindowStart(now = Date.now()): Date {
  return new Date(now - FOUR_WEEKS_MS)
}

/** Meta builds published or re-validated within the last 4 weeks. */
export function getResearchedMetaBuilds(now = Date.now()): ExternalBuildSource[] {
  const windowStart = metaResearchWindowStart(now).getTime()
  return RESEARCHED_META_BUILDS.filter((build) => {
    const published = build.publishedAt ? Date.parse(build.publishedAt) : 0
    const checked = Date.parse(build.lastChecked)
    return published >= windowStart || checked >= windowStart
  })
}

export function metaResearchSummary(builds: ExternalBuildSource[]): string {
  if (!builds.length) {
    return 'No external meta builds in the 4-week research window. Check back after the next research pass.'
  }
  const sites = Array.from(new Set(builds.map((b) => b.sourceSite ?? b.source))).slice(0, 4)
  return `${builds.length} meta build(s) from the last 4 weeks — researched from ${sites.join(', ')}. Verified PGCR builds are shown separately.`
}

export const META_RESEARCH_SOURCES = [
  { name: 'Blueberries.gg', url: 'https://www.blueberries.gg/armor/best-destiny-2-builds/' },
  { name: 'light.gg Loadouts', url: 'https://www.light.gg/loadouts/db/' },
  { name: 'togame.io Meta', url: 'https://togame.io/a/destiny2-pve-loadout-meta/' },
  { name: 'builders.gg', url: 'https://builders.gg/destiny/dim-builds/' },
  { name: 'D2Foundry', url: 'https://d2foundry.gg/' },
]
