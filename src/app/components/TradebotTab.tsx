'use client'

import { Bot } from 'lucide-react'

interface TradebotTabProps {
  darkMode: boolean
  subtitleClasses: string
  title: string
  comingSoonLabel: string
}

export default function TradebotTab({
  darkMode,
  subtitleClasses,
  title,
  comingSoonLabel,
}: TradebotTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Bot className={`w-16 h-16 mb-4 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
      <h4 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h4>
      <p className={`text-sm max-w-md ${subtitleClasses}`}>{comingSoonLabel}</p>
    </div>
  )
}
