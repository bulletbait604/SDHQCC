import type { BuildIntelligenceCard, BuildSnapshot, RunRecord } from '@/lib/destiny/types'

interface BuildGroup {
  signature: string
  snapshots: BuildSnapshot[]
}

function buildSignature(snapshot: BuildSnapshot): string {
  if (snapshot.buildSignature) return snapshot.buildSignature
  return [
    snapshot.characterClass,
    snapshot.exoticArmor,
    snapshot.exoticWeapon ?? '',
    snapshot.kineticWeapon,
    snapshot.energyWeapon,
    snapshot.powerWeapon,
    snapshot.activityName,
  ].join('|')
}

function inferRole(deathRate: number): BuildIntelligenceCard['role'] {
  if (deathRate <= 1.5) return 'dps'
  if (deathRate >= 4) return 'support'
  return 'balanced'
}

function inferFireteamType(
  composition: string
): BuildIntelligenceCard['fireteamType'] {
  if (composition === 'full_clan') return 'clan'
  if (composition === 'pickup') return 'solo_friendly'
  return 'mixed'
}

/** Aggregate verified PGCR build snapshots into community intelligence cards. */
export function aggregateBuildIntelligence(
  snapshots: BuildSnapshot[],
  verifiedRunIds?: Set<string>
): BuildIntelligenceCard[] {
  const verified = snapshots.filter((s) => {
    if (verifiedRunIds && !verifiedRunIds.has(s.runId)) return false
    if (s.verificationStatus && s.verificationStatus !== 'verified') return false
    return true
  })

  const groups = new Map<string, BuildGroup>()
  for (const snap of verified) {
    const signature = buildSignature(snap)
    const group = groups.get(signature) ?? { signature, snapshots: [] }
    group.snapshots.push(snap)
    groups.set(signature, group)
  }

  const total = verified.length || 1

  return Array.from(groups.values())
    .map((group) => {
      const first = group.snapshots[0]!
      const clears = group.snapshots.length
      const avgDuration =
        group.snapshots.reduce((s, b) => s + (b.durationSeconds ?? 0), 0) / clears
      const totalDeaths = group.snapshots.reduce((s, b) => s + (b.deaths ?? 0), 0)
      const deathRate = totalDeaths / clears
      const successRate = group.snapshots.filter((b) => (b.deaths ?? 0) <= 3).length / clears

      const exoticLabel = first.exoticArmor !== 'Unknown exotic' ? first.exoticArmor : first.exoticWeapon
      const buildName = exoticLabel
        ? `${first.subclass} ${first.characterClass} · ${exoticLabel}`
        : `${first.subclass} ${first.characterClass} build`

      return {
        id: `bi-${group.signature.replace(/[^a-z0-9]+/gi, '-').slice(0, 48)}`,
        buildName,
        activityName: first.activityName,
        activityId: first.activityId,
        characterClass: first.characterClass,
        subclass: first.subclass,
        exoticArmor: first.exoticArmor,
        exoticWeapon: first.exoticWeapon,
        weapons: [first.kineticWeapon, first.energyWeapon, first.powerWeapon].filter(Boolean),
        keyStats: first.stats ?? {},
        averageClearSeconds: Math.round(avgDuration),
        usageRatePercent: Math.round((clears / total) * 1000) / 10,
        successRatePercent: Math.round(successRate * 1000) / 10,
        deathRatePercent: Math.round(deathRate * 10) / 10,
        topTeamName: first.fireteamComposition === 'full_clan' ? 'Full clan fireteam' : 'Community fireteam',
        fireteamType: inferFireteamType(first.fireteamComposition),
        role: inferRole(deathRate),
      } satisfies BuildIntelligenceCard
    })
    .sort((a, b) => b.usageRatePercent - a.usageRatePercent || b.successRatePercent - a.successRatePercent)
    .slice(0, 40)
}

export function verifiedRunIdSet(runs: RunRecord[]): Set<string> {
  return new Set(runs.filter((r) => r.verificationStatus === 'verified').map((r) => r.id))
}
