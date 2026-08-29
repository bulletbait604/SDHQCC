'use client'

import { RadioTower, Sparkles } from 'lucide-react'

interface Props {
  darkMode: boolean
  subtitleClasses: string
  description: string
  comingSoonLabel: string
}

export default function GoingLiveTab({
  darkMode,
  subtitleClasses,
  description,
  comingSoonLabel,
}: Props) {
  return (
    <div className="relative py-8">
      <div className="flex flex-col items-center text-center max-w-lg mx-auto px-4">
        <div
          className={`mb-5 p-4 rounded-full ${
            darkMode ? 'bg-sdhq-green-500/15' : 'bg-sdhq-green-100'
          }`}
        >
          <RadioTower className="w-10 h-10 text-sdhq-green-500" />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-sdhq-cyan-500" />
          <p
            className={`text-lg font-semibold ${
              darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'
            }`}
          >
            {comingSoonLabel}
          </p>
          <Sparkles className="w-4 h-4 text-sdhq-cyan-500" />
        </div>
        <p className={`text-base ${subtitleClasses}`}>{description}</p>
      </div>
    </div>
  )
}
