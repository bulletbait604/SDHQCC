'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { BuildSnapshot } from '@/lib/destiny/types'
import {
  GearStrip,
  GlassCard,
  ItemIcon,
  LoadingBlock,
  PageIntro,
  SubclassBadge,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface LoadoutsResponse {
  current: BuildSnapshot | null
  saved: BuildSnapshot[]
  favorites: BuildSnapshot[]
  equipSupported: boolean
  equipMessage: string
  linked?: boolean
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
    <div className={cn('rounded-2xl p-5', getDestinyTheme(darkMode).glassInset)}>
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
    <div className="space-y-6">
      <PageIntro
        darkMode={darkMode}
        title="Loadouts"
        description="Your live gear from Bungie. Copy builds to share — equip support coming soon."
      />

      <GlassCard darkMode={darkMode}>
        {data?.current ? (
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
          <p className={t.muted}>{data?.equipMessage ?? 'Connect Bungie on Overview to view your loadout.'}</p>
        )}
      </GlassCard>
    </div>
  )
}
