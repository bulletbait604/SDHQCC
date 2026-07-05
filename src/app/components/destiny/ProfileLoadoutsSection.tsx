'use client'

import { useCallback, useEffect, useState } from 'react'
import { Hammer, ExternalLink } from 'lucide-react'
import type { BuildIntelligenceCard, BuildSnapshot, ExternalBuildSource } from '@/lib/destiny/types'
import {
  EmptyBlock,
  GlassCard,
  PageIntro,
  SectionTitle,
  SegmentedControl,
} from '@/app/components/destiny/DestinyUi'
import LoadoutCard from '@/app/components/destiny/LoadoutCard'
import CommunityBuildCard from '@/app/components/destiny/CommunityBuildCard'
import TopLoadoutsByClass from '@/app/components/destiny/TopLoadoutsByClass'
import { rankTopLoadoutsByClass } from '@/lib/destiny/loadoutRankings'
import { destinySecondaryBtn, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface LoadoutsResponse {
  current: BuildSnapshot | null
  saved: BuildSnapshot[]
  favorites: BuildSnapshot[]
  equipSupported: boolean
  equipMessage: string
}

type LoadoutSection = 'mine' | 'community' | 'builder'

interface Props {
  darkMode: boolean
  initialSection?: LoadoutSection
}

export default function ProfileLoadoutsSection({ darkMode, initialSection = 'mine' }: Props) {
  const [section, setSection] = useState<LoadoutSection>(initialSection)
  const [loadouts, setLoadouts] = useState<LoadoutsResponse | null>(null)
  const [verifiedBuilds, setVerifiedBuilds] = useState<BuildIntelligenceCard[]>([])
  const [externalBuilds, setExternalBuilds] = useState<ExternalBuildSource[]>([])
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [loadoutRes, buildsRes] = await Promise.all([
        fetch('/api/destiny/loadouts', { credentials: 'include' }),
        fetch('/api/destiny/builds', { credentials: 'include' }),
      ])
      if (loadoutRes.ok) setLoadouts(await loadoutRes.json())
      if (buildsRes.ok) {
        const json = await buildsRes.json()
        setVerifiedBuilds(json.verifiedBuilds ?? [])
        setExternalBuilds(json.externalBuilds ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  useEffect(() => {
    load()
  }, [load])

  const topByClass = rankTopLoadoutsByClass(verifiedBuilds, 5)

  return (
    <div className="space-y-6">
      <PageIntro
        darkMode={darkMode}
        title="Loadouts"
        description="Your live gear, saved builds, community favorites, and the loadout builder."
      />

      <SegmentedControl
        label="Section"
        darkMode={darkMode}
        value={section}
        onChange={setSection}
        options={[
          { value: 'mine', label: 'My loadouts' },
          { value: 'community', label: 'Top builds' },
          { value: 'builder', label: 'Builder' },
        ]}
      />

      {loading ? (
        <GlassCard darkMode={darkMode}>
          <p className={cn('text-sm text-center py-8', t.muted)}>Loading loadouts…</p>
        </GlassCard>
      ) : section === 'mine' ? (
        <>
          {loadouts?.equipMessage && !loadouts.current && (
            <p className={cn('text-sm leading-relaxed', t.muted)}>{loadouts.equipMessage}</p>
          )}

          <GlassCard darkMode={darkMode}>
            <SectionTitle title="Currently equipped" subtitle="Live from your Bungie account" darkMode={darkMode} />
            {loadouts?.current ? (
              <LoadoutCard build={loadouts.current} darkMode={darkMode} title="Active guardian" />
            ) : (
              <EmptyBlock
                darkMode={darkMode}
                message="No live loadout"
                hint="Connect Bungie on Home to pull your current gear."
              />
            )}
          </GlassCard>

          <GlassCard darkMode={darkMode}>
            <SectionTitle title="Saved loadouts" subtitle="Builds you save for quick copy or equip" darkMode={darkMode} />
            {loadouts?.saved?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadouts.saved.map((b, i) => (
                  <LoadoutCard key={b.id + i} build={b} darkMode={darkMode} title={`Saved ${i + 1}`} />
                ))}
              </div>
            ) : (
              <EmptyBlock
                darkMode={darkMode}
                message="No saved loadouts yet"
                hint="Use the builder (coming soon) or save from your current gear."
              />
            )}
            <button
              type="button"
              disabled
              className={cn(destinySecondaryBtn(darkMode), 'mt-4 opacity-50 cursor-not-allowed')}
              title="Save from current gear — coming soon"
            >
              Save current loadout
            </button>
          </GlassCard>

          {loadouts?.favorites?.length ? (
            <GlassCard darkMode={darkMode}>
              <SectionTitle title="Favorites" darkMode={darkMode} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadouts.favorites.map((b, i) => (
                  <LoadoutCard key={'fav-' + i} build={b} darkMode={darkMode} title="Favorite" />
                ))}
              </div>
            </GlassCard>
          ) : null}
        </>
      ) : section === 'community' ? (
        <>
          <TopLoadoutsByClass
            darkMode={darkMode}
            topByClass={topByClass}
            title="Top loadouts by class"
            subtitle="Ranked from verified community clears"
          />

          <GlassCard darkMode={darkMode}>
            <SectionTitle
              title="All verified builds"
              subtitle="From synced PGCR data across Top Nest"
              darkMode={darkMode}
            />
            {verifiedBuilds.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {verifiedBuilds.map((b) => (
                  <CommunityBuildCard key={b.id} build={b} darkMode={darkMode} />
                ))}
              </div>
            ) : (
              <EmptyBlock
                darkMode={darkMode}
                message="No verified builds yet"
                hint="Sync runs from Home to populate community loadout stats."
              />
            )}
          </GlassCard>

          {externalBuilds.length > 0 && (
            <GlassCard darkMode={darkMode}>
              <SectionTitle title="Curated external builds" darkMode={darkMode} />
              <div className="space-y-2">
                {externalBuilds.map((ext) => (
                  <div
                    key={ext.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/5 last:border-0"
                  >
                    <div>
                      <p className={cn('text-sm font-medium', t.heading)}>{ext.title}</p>
                      <p className={cn('text-xs mt-0.5', t.muted)}>
                        {ext.source} · {ext.class} {ext.subclass}
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
          )}
        </>
      ) : (
        <GlassCard darkMode={darkMode} padding="lg">
          <div className="flex flex-col items-center text-center py-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.08] flex items-center justify-center mb-4">
              <Hammer className="w-7 h-7 text-white/60" />
            </div>
            <h4 className={cn('text-lg font-semibold', t.heading)}>Loadout builder</h4>
            <p className={cn('text-sm mt-2 leading-relaxed', t.muted)}>
              Plan exotic armor, aspects, fragments, and weapons before you jump into a raid or dungeon. Save builds
              to your profile and share with your fireteam.
            </p>
            <p className={cn('text-xs mt-4 px-4 py-2 rounded-full', t.glassInset, t.caption)}>Coming soon</p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
