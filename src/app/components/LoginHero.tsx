'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

const LOGO_URL = 'https://iili.io/BeYpM5F.md.png'

export interface LoginHeroProps {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  welcome: string
  description: string
  loginButtonLabel: string
  onLogin: () => void
}

export default function LoginHero({
  darkMode,
  cardClasses,
  textClasses,
  welcome,
  description,
  loginButtonLabel,
  onLogin,
}: LoginHeroProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[420px] ${cardClasses} mt-4`}>
      <div className="flex flex-col items-center text-center w-full max-w-lg px-5 py-6">
        <Image
          src={LOGO_URL}
          alt="Stream Dreams Creator Corner"
          width={320}
          height={320}
          priority
          className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 object-contain mb-2 rounded-2xl mx-auto"
        />
        <h2
          className={`text-3xl font-bold gradient-text mb-3 mt-0 ${darkMode ? 'from-sdhq-cyan-400 to-sdhq-green-400' : ''}`}
        >
          {welcome}
        </h2>
        <p className={`${textClasses} mb-8 max-w-md mx-auto`}>{description}</p>
        <Button onClick={onLogin} className="sdhq-button text-xl px-8 py-3">
          {loginButtonLabel}
        </Button>
      </div>
    </div>
  )
}
