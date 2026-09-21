'use client'

import { LogOut, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BANNED_USER_MESSAGE } from '@/lib/bannedUserMessage'

type BannedUserScreenProps = {
  darkMode: boolean
  message?: string
}

export default function BannedUserScreen({ darkMode, message }: BannedUserScreenProps) {
  const text = message?.trim() || BANNED_USER_MESSAGE

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 text-center ${
        darkMode ? 'bg-[#05070d]' : 'bg-gradient-to-br from-cyan-50 to-rose-50'
      }`}
    >
      <div className="sdhq-page-orbs" />
      <div className="relative z-10 max-w-lg rounded-3xl border border-red-500/20 bg-red-500/5 p-8 shadow-xl">
      <UserX className={`w-16 h-16 mb-6 mx-auto ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
      <p
        className={`max-w-lg text-lg sm:text-xl font-medium leading-relaxed ${
          darkMode ? 'text-gray-200' : 'text-gray-800'
        }`}
      >
        {text}
      </p>
      <Button
        type="button"
        variant="outline"
        className={`mt-8 ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
        onClick={() => {
          void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
            window.location.href = '/'
          })
        }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign out
      </Button>
      </div>
    </div>
  )
}
