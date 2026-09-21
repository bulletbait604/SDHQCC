'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Sparkles, Wand2, BarChart3, GraduationCap } from 'lucide-react'

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

const HIGHLIGHTS = [
  { icon: GraduationCap, label: 'Learn the algorithms' },
  { icon: Wand2, label: 'Create faster with AI' },
  { icon: BarChart3, label: 'Analyze your clips' },
]

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
    <div className={`relative mt-6 overflow-hidden ${cardClasses}`}>
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
          darkMode
            ? 'from-sdhq-cyan-500/10 via-transparent to-emerald-400/10'
            : 'from-cyan-100/70 via-transparent to-emerald-100/60'
        }`}
      />
      <div className="relative flex min-h-[460px] flex-col items-center justify-center px-5 py-10 text-center">
        <Image
          src={LOGO_URL}
          alt="Stream Dreams Creator Corner"
          width={320}
          height={320}
          priority
          className="mx-auto mb-3 h-52 w-52 rounded-3xl object-contain sm:h-64 sm:w-64 md:h-72 md:w-72 animate-float"
        />
        <span
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            darkMode
              ? 'bg-sdhq-cyan-500/15 text-sdhq-cyan-300'
              : 'bg-sdhq-cyan-100 text-sdhq-cyan-700'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Creator toolkit
        </span>
        <h2 className="mb-3 mt-0 max-w-2xl text-3xl font-extrabold tracking-tight gradient-text sm:text-4xl">
          {welcome}
        </h2>
        <p className={`${textClasses} mx-auto mb-8 max-w-lg text-base leading-relaxed sm:text-lg`}>
          {description}
        </p>
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon
            return (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm ${
                  darkMode
                    ? 'border-white/10 bg-white/5 text-gray-200'
                    : 'border-sdhq-cyan-200 bg-white text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5 text-sdhq-cyan-400" />
                {item.label}
              </span>
            )
          })}
        </div>
        <Button onClick={onLogin} className="sdhq-button px-8 py-3 text-lg">
          {loginButtonLabel}
        </Button>
      </div>
    </div>
  )
}
