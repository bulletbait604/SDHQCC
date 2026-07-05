'use client'

import { useCallback, useEffect, useState } from 'react'
import { Brain, Copy, ExternalLink } from 'lucide-react'
import type { BuildIntelligenceCard, ExternalBuildSource } from '@/lib/destiny/types'
import {
  ActivityBadge,
  GearStrip,
  GlassCard,
  LoadingBlock,
  SectionTitle,
  StatusPill,
  SubclassBadge,
} from '@/app/components/destiny/DestinyUi'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function BuildIntelPanel({ darkMode }: { darkMode: boolean }) {
  const [verifiedBuilds, setVerifiedBuilds] = useState<BuildIntelligenceCard[]>([])
  const [externalBuilds, setExternalBuilds] = useState<ExternalBuildSource[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/builds', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setVerifiedBuilds(json.verifiedBuilds ?? [])
        setExternalBuilds(json.externalBuilds ?? [])
        setAiSummary(json.aiSummary ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock darkMode={darkMode} />

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <SectionTitle
            title="Build Intelligence"
            subtitle="Top builds from verified DestinyTopNest runs — not random scrapes"
            darkMode={darkMode}
          />
        </div>
        {aiSummary && (
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/25 p-3 mb-4">
            <p className={cn('text-sm text-purple-100')}>{aiSummary}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {verifiedBuilds.map((b) => (
            <div key={b.id} className="rounded-xl p-4 bg-black/30 border border-amber-500/20">
              <div className="flex justify-between gap-2 mb-2">
                <p className="text-white font-semibold">{b.buildName}</p>
                <StatusPill label={b.role} tone="gold" />
              </div>
              <ActivityBadge activityRef={b.activityRef} name={b.activityName} darkMode={darkMode} size={36} />
              <div className="mt-3">
                <SubclassBadge
                  classRef={b.classRef}
                  subclassRef={b.subclassRef}
                  characterClass={b.characterClass}
                  subclass={b.subclass}
                  darkMode={darkMode}
                />
              </div>
              <div className="mt-3">
                <GearStrip
                  darkMode={darkMode}
                  items={[b.exoticArmorRef, b.exoticWeaponRef, ...(b.weaponRefs ?? [])]}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <span className={t.gold}>{b.usageRatePercent}% usage</span>
                <span className={t.blue}>{b.successRatePercent}% success</span>
                <span className={t.muted}>Avg {formatDuration(b.averageClearSeconds)}</span>
                <span className={t.muted}>{b.deathRatePercent}% deaths</span>
              </div>
              <p className={cn('text-xs mt-2', t.purple)}>Top team: {b.topTeamName}</p>
              <button
                type="button"
                className="mt-3 flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${b.buildName}: ${b.subclass} ${b.characterClass}, ${b.exoticArmor}, ${b.weapons.join(', ')}`
                  )
                }
              >
                <Copy className="w-3 h-3" /> Copy / share
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard darkMode={darkMode}>
        <SectionTitle
          title="Current Online Builds (curated)"
          subtitle="Admin-approved external sources · cached with last-checked date"
          darkMode={darkMode}
        />
        <div className="space-y-2">
          {externalBuilds.map((ext) => (
            <div
              key={ext.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5"
            >
              <div>
                <p className="text-white text-sm">{ext.title}</p>
                <p className={cn('text-xs', t.muted)}>
                  {ext.source} · {ext.class} {ext.subclass} · checked{' '}
                  {new Date(ext.lastChecked).toLocaleDateString()}
                </p>
              </div>
              <a
                href={ext.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
              >
                Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
