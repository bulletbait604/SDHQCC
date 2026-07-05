'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gift, Clock, Trophy } from 'lucide-react'
import type { Season, SeasonWinner } from '@/lib/destiny/types'
import { GlassCard, LoadingBlock, SectionTitle } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function SeasonPanel({ darkMode }: { darkMode: boolean }) {
  const [season, setSeason] = useState<Season | null>(null)
  const [countdown, setCountdown] = useState<{ days: number; hours: number; label: string } | null>(null)
  const [eligibility, setEligibility] = useState('')
  const [hallOfFame, setHallOfFame] = useState<SeasonWinner[]>([])
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/season', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setSeason(json.season)
        setCountdown(json.countdown)
        setEligibility(json.eligibility)
        setHallOfFame(json.hallOfFame ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (!season) return null

  const rules = season.prizeRules

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{season.name} Season</h3>
            <p className={cn('text-sm', t.muted)}>
              {new Date(season.startDate).toLocaleDateString()} —{' '}
              {new Date(season.endDate).toLocaleDateString()}
            </p>
          </div>
          {countdown && (
            <div className="flex items-center gap-2 ml-auto">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className={cn('text-sm font-medium', t.purple)}>
                {countdown.days}d {countdown.hours}h left
              </span>
            </div>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-amber-400" />
            <SectionTitle title="Raid prizes" darkMode={darkMode} />
          </div>
          <ul className={cn('text-xs space-y-1', t.muted)}>
            <li>1st: {rules.raid.first}</li>
            <li>2nd: {rules.raid.second}</li>
            <li>3rd–5th: {rules.raid.thirdToFifth}</li>
            <li>All: {rules.raid.participation}</li>
          </ul>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Dungeon prizes" darkMode={darkMode} />
          <ul className={cn('text-xs space-y-1', t.muted)}>
            <li>1st: {rules.dungeon.first}</li>
            <li>2nd: {rules.dungeon.second}</li>
            <li>3rd–5th: {rules.dungeon.thirdToFifth}</li>
            <li>All: {rules.dungeon.participation}</li>
          </ul>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Full clan team" darkMode={darkMode} />
          <ul className={cn('text-xs space-y-1', t.muted)}>
            <li>1st: {rules.fullClanTeam.first}</li>
            <li>2nd: {rules.fullClanTeam.second}</li>
            <li>3rd: {rules.fullClanTeam.third}</li>
          </ul>
        </GlassCard>
      </div>

      <GlassCard darkMode={darkMode}>
        <SectionTitle title="Eligibility & rules" darkMode={darkMode} />
        <p className={cn('text-sm', t.muted)}>{eligibility}</p>
        <ul className={cn('text-xs mt-3 space-y-1 list-disc list-inside', t.muted)}>
          <li>Points only for verified full completions</li>
          <li>2 pts per clan member · 5 pts per rando (raid max 2 randos, dungeon max 1)</li>
          <li>Checkpoint runs tracked but not scored unless admin approved</li>
          <li>Suspicious runs blocked until review (score 70+)</li>
        </ul>
      </GlassCard>

      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <SectionTitle title="Hall of Fame" darkMode={darkMode} />
        </div>
        {hallOfFame.length ? (
          hallOfFame.map((w, i) => (
            <div key={i} className="py-2 border-b border-white/5 flex justify-between gap-2">
              <span className="text-white text-sm">
                #{w.rank} {w.displayName} {w.clanTag}
              </span>
              <span className={cn('text-xs', t.gold)}>{w.prize}</span>
            </div>
          ))
        ) : (
          <p className={t.muted}>No past winners yet.</p>
        )}
      </GlassCard>
    </div>
  )
}
