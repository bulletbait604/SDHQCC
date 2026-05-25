'use client'

import { Heart, Sparkles, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  title: string
  comingSoonLabel: string
  donateLabel: string
  onDonate: () => void
}

export default function KickClipsComingSoon({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  title,
  comingSoonLabel,
  donateLabel,
  onDonate,
}: Props) {
  return (
    <div className={`py-12 px-4 sm:px-8 ${cardClasses}`}>
      <div className="max-w-lg mx-auto flex flex-col items-center text-center">
        <div
          className={`mb-6 p-5 rounded-full ${
            darkMode ? 'bg-sdhq-green-500/15' : 'bg-sdhq-green-100'
          }`}
        >
          <Video className="w-14 h-14 text-sdhq-green-500" />
        </div>
        <h3 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-sdhq-cyan-500" />
          <p className={`text-xl font-semibold ${darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'}`}>
            {comingSoonLabel}
          </p>
          <Sparkles className="w-5 h-5 text-sdhq-cyan-500" />
        </div>
        <p className={`${textClasses} mb-8 max-w-md`}>
          The KICK Clips app integration is in development. Support the project to help us ship it sooner.
        </p>
        <Button
          type="button"
          onClick={onDonate}
          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold px-8 py-3 text-lg shadow-lg"
        >
          <Heart className="w-5 h-5 mr-2 fill-current" />
          {donateLabel}
        </Button>
        <p className={`${subtitleClasses} mt-4 text-sm`}>Secure donation via PayPal</p>
      </div>
    </div>
  )
}
