'use client'

import type { TargetPlatform } from '@/lib/platformEditing'

interface PlatformSelectorProps {
  targetPlatform: TargetPlatform
  setTargetPlatform: (value: TargetPlatform) => void
  disabled?: boolean
}

const PLATFORMS: Array<{ id: TargetPlatform; label: string }> = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube Shorts' },
  { id: 'reels', label: 'Instagram Reels' },
]

export default function PlatformSelector({
  targetPlatform,
  setTargetPlatform,
  disabled = false,
}: PlatformSelectorProps) {
  return (
    <select
      value={targetPlatform}
      onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-lg border text-sm bg-sdhq-dark-900 border-sdhq-cyan-500/30 text-gray-200 disabled:opacity-60"
    >
      {PLATFORMS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  )
}
