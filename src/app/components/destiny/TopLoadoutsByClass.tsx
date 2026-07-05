'use client'

import type { BuildIntelligenceCard, DestinyCharacterClass } from '@/lib/destiny/types'
import { GlassCard, SectionTitle, EmptyBlock } from '@/app/components/destiny/DestinyUi'
import CommunityBuildCard from '@/app/components/destiny/CommunityBuildCard'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const CLASS_LABELS: Record<DestinyCharacterClass, string> = {
  titan: 'Titan',
  hunter: 'Hunter',
  warlock: 'Warlock',
}

interface Props {
  darkMode: boolean
  topByClass: Record<DestinyCharacterClass, BuildIntelligenceCard[]>
  compact?: boolean
  title?: string
  subtitle?: string
}

export default function TopLoadoutsByClass({
  darkMode,
  topByClass,
  compact,
  title = 'Top loadouts by class',
  subtitle = 'Most-used builds from verified clears this season',
}: Props) {
  const t = getDestinyTheme(darkMode)
  const hasAny = (['titan', 'hunter', 'warlock'] as const).some((c) => topByClass[c]?.length)

  if (!hasAny) {
    return (
      <GlassCard darkMode={darkMode}>
        <SectionTitle title={title} subtitle={subtitle} darkMode={darkMode} />
        <EmptyBlock
          darkMode={darkMode}
          message="No community loadout data yet"
          hint="Sync verified runs from Home after linking Bungie."
        />
      </GlassCard>
    )
  }

  return (
    <GlassCard darkMode={darkMode}>
      <SectionTitle title={title} subtitle={subtitle} darkMode={darkMode} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['titan', 'hunter', 'warlock'] as const).map((cls) => (
          <div key={cls}>
            <p className={cn('text-sm font-semibold mb-3', t.heading)}>{CLASS_LABELS[cls]}</p>
            <div className="space-y-3">
              {topByClass[cls]?.length ? (
                topByClass[cls].map((b) => (
                  <CommunityBuildCard key={b.id} build={b} darkMode={darkMode} compact={compact} />
                ))
              ) : (
                <p className={cn('text-sm', t.muted)}>No data for {CLASS_LABELS[cls]} yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
