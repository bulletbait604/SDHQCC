import type { BuildIntelligenceCard, DestinyCharacterClass } from '@/lib/destiny/types'

const CLASSES: DestinyCharacterClass[] = ['titan', 'hunter', 'warlock']

export type TopLoadoutsByClass = Record<DestinyCharacterClass, BuildIntelligenceCard[]>

function scoreBuild(b: BuildIntelligenceCard): number {
  return b.usageRatePercent * 2 + b.successRatePercent - b.deathRatePercent
}

/** Top N community loadouts per class, ranked by usage and success from verified runs. */
export function rankTopLoadoutsByClass(
  builds: BuildIntelligenceCard[],
  perClass = 2
): TopLoadoutsByClass {
  const result = {} as TopLoadoutsByClass
  for (const cls of CLASSES) {
    result[cls] = builds
      .filter((b) => b.characterClass === cls)
      .sort((a, b) => scoreBuild(b) - scoreBuild(a))
      .slice(0, perClass)
  }
  return result
}
