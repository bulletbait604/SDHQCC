'use client'

import { Camera, Play, Smartphone } from 'lucide-react'

import type { TargetPlatform } from '@/lib/platformEditing'

interface PlatformSelectorProps {
  targetPlatform: TargetPlatform
  setTargetPlatform: (value: TargetPlatform) => void
  disabled?: boolean
}

const PLATFORMS: Array<{
  id: TargetPlatform
  label: string
  Icon: typeof Smartphone
}> = [
  { id: 'tiktok', label: 'TikTok', Icon: Smartphone },
  { id: 'youtube', label: 'YouTube Shorts', Icon: Play },
  { id: 'reels', label: 'Instagram Reels', Icon: Camera },
]

export default function PlatformSelector({
  targetPlatform,
  setTargetPlatform,
  disabled = false,
}: PlatformSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {PLATFORMS.map(({ id, label, Icon }) => {
        const active = targetPlatform === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => setTargetPlatform(id)}
            className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 transition ${
              active
                ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/10 text-sdhq-cyan-300'
                : 'border-sdhq-cyan-500/30 hover:border-sdhq-cyan-400 text-gray-300'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
