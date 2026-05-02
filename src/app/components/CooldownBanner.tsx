'use client'

import { Loader2 } from 'lucide-react'

interface Props {
  secondsRemaining: number
  watchingAd: boolean
  adReady: boolean
  onWatchAd: () => void
  tool: 'thumbnail' | 'clip-analyzer'
  darkMode?: boolean
  formatTime: (s: number) => string
}

export default function CooldownBanner({
  secondsRemaining,
  watchingAd,
  adReady,
  onWatchAd,
  tool,
  darkMode = true,
  formatTime
}: Props) {
  const label = tool === 'thumbnail' ? 'Thumbnail Generator' : 'Clip Analyzer'
  const cooldownLabel = tool === 'thumbnail' ? '60 second cooldown' : '1 hour cooldown'

  return (
    <div className={`rounded-xl border-2 p-6 text-center space-y-4 ${
      darkMode
        ? 'bg-sdhq-dark-800 border-sdhq-cyan-500/30'
        : 'bg-white border-sdhq-cyan-200'
    }`}>
      <div className="text-4xl">⏳</div>

      <div>
        <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {label} Cooldown
        </p>
        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Free users have a {cooldownLabel} between uses.
        </p>
      </div>

      {/* Countdown */}
      <div className={`text-5xl font-mono font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
        {formatTime(secondsRemaining)}
      </div>

      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Watch a short ad to skip the wait instantly.
      </p>

      {/* Watch Ad button */}
      <button
        onClick={onWatchAd}
        disabled={watchingAd || !adReady}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {watchingAd ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Playing Ad...</>
        ) : !adReady ? (
          <>Loading...</>
        ) : (
          <>▶ Watch Ad to Skip</>
        )}
      </button>

      {/* Upgrade nudge */}
      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        ⭐ Subscribers get unlimited use with no cooldowns or ads.
      </p>
    </div>
  )
}
