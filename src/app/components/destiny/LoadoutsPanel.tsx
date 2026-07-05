'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, AlertCircle } from 'lucide-react'
import type { BuildSnapshot } from '@/lib/destiny/types'
import {
  GearStrip,
  GlassCard,
  ItemIcon,
  LoadingBlock,
  SectionTitle,
  SubclassBadge,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface LoadoutsResponse {
  current: BuildSnapshot
  saved: BuildSnapshot[]
  favorites: BuildSnapshot[]
  equipSupported: boolean
  equipMessage: string
}

function LoadoutCard({
  build,
  darkMode,
  title,
}: {
  build: BuildSnapshot
  darkMode: boolean
  title: string
}) {
  const t = getDestinyTheme(darkMode)
  const copyText = [
    `${build.subclass} ${build.characterClass}`,
    `Exotic: ${build.exoticArmor}${build.exoticWeapon ? ` / ${build.exoticWeapon}` : ''}`,
    `Weapons: ${build.kineticWeapon} / ${build.energyWeapon} / ${build.powerWeapon}`,
    `Aspects: ${build.aspects.join(', ')}`,
    `Fragments: ${build.fragments.join(', ')}`,
  ].join('\n')

  return (
    <div className="rounded-lg bg-black/30 p-4 border border-white/10">
      <p className={cn('text-xs font-semibold mb-3', t.gold)}>{title}</p>
      <SubclassBadge
        classRef={build.classRef}
        subclassRef={build.subclassRef}
        characterClass={build.characterClass}
        subclass={build.subclass}
        darkMode={darkMode}
      />
      <div className="mt-3">
        <p className={cn('text-xs mb-2', t.muted)}>Exotic armor</p>
        <div className="flex items-center gap-2">
          <ItemIcon item={build.exoticArmorRef} name={build.exoticArmor} size={44} />
          <span className="text-sm text-white">{build.exoticArmorRef?.name ?? build.exoticArmor}</span>
        </div>
      </div>
      <div className="mt-3">
        <p className={cn('text-xs mb-2', t.muted)}>Weapons</p>
        <GearStrip
          darkMode={darkMode}
          items={[
            build.kineticWeaponRef,
            build.energyWeaponRef,
            build.powerWeaponRef,
            build.exoticWeaponRef,
          ]}
        />
      </div>
      {build.aspectRefs && build.aspectRefs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {build.aspectRefs.map((aspect, i) => (
            <ItemIcon key={i} item={aspect} size={28} title={aspect.name} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-purple-500/20 text-purple-200 border border-purple-500/30"
          onClick={() => navigator.clipboard.writeText(copyText)}
        >
          <Copy className="w-3 h-3" /> Copy build
        </button>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
          title="Requires Bungie OAuth"
        >
          Equip (OAuth)
        </button>
      </div>
    </div>
  )
}

export default function LoadoutsPanel({ darkMode }: { darkMode: boolean }) {
  const [data, setData] = useState<LoadoutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/loadouts', { credentials: 'include' })
      if (res.ok) setData(await res.json())
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
      {data && !data.equipSupported && (
        <div className="flex items-start gap-2 rounded-xl p-3 bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className={cn('text-xs', t.muted)}>{data.equipMessage}</p>
        </div>
      )}

      <GlassCard darkMode={darkMode}>
        <SectionTitle
          title="Loadouts"
          subtitle="Icons from Bungie manifest · view · copy · equip where supported"
          darkMode={darkMode}
        />
        {data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <LoadoutCard build={data.current} darkMode={darkMode} title="Currently equipped" />
            {data.saved.map((b, i) => (
              <LoadoutCard key={b.id + i} build={b} darkMode={darkMode} title="Saved loadout" />
            ))}
            {data.favorites.map((b, i) => (
              <LoadoutCard key={'fav-' + i} build={b} darkMode={darkMode} title="Favorite" />
            ))}
          </div>
        ) : (
          <p className={t.muted}>No loadout data.</p>
        )}
      </GlassCard>
    </div>
  )
}
