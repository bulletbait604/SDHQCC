'use client'

import { D2_STAT_COLORS } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const STAT_ORDER = [
  { key: 'Mobility' as const, label: 'Mob', short: 'CL' },
  { key: 'Resilience' as const, label: 'Res', short: 'HP' },
  { key: 'Recovery' as const, label: 'Rec', short: 'WE' },
  { key: 'Discipline' as const, label: 'Dis', short: 'GN' },
  { key: 'Intellect' as const, label: 'Int', short: 'SU' },
  { key: 'Strength' as const, label: 'Str', short: 'ME' },
] as const

/** light.gg / DIM-style horizontal stat bars (0–100). */
export default function ArmorStatMatrix({
  stats,
  tier = 100,
  compact,
}: {
  stats: Record<string, number>
  tier?: number
  compact?: boolean
}) {
  return (
    <div className={cn('d2-stat-matrix', compact && 'd2-stat-matrix-compact')}>
      {STAT_ORDER.map(({ key, label, short }) => {
        const value = stats[key] ?? 0
        const pct = Math.min(100, Math.max(0, (value / tier) * 100))
        const color = D2_STAT_COLORS[key]

        return (
          <div key={key} className="d2-stat-matrix-row" title={`${label}: ${value}`}>
            <span className="d2-stat-matrix-label">{compact ? short : label}</span>
            <div className="d2-stat-matrix-track">
              <div
                className="d2-stat-matrix-fill"
                style={
                  {
                    width: `${pct}%`,
                    '--stat-color': color,
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="d2-stat-matrix-value">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
