'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  User,
  LogOut,
  Settings,
  Shield,
  Coins,
  Crown,
  Moon,
  Sun,
  Heart,
  Plus,
} from 'lucide-react'
import type { HomeLanguage, KickUser } from '@/lib/home/types'
import { ROLE_CONFIG, type Role } from '@/lib/home/roles'

export interface HomeHeaderProps {
  headerClasses: string
  darkMode: boolean
  user: KickUser | null
  userRole: Role
  balance: number
  language: HomeLanguage
  verifySubscriptionLabel: string
  settingsLabel: string
  logoutLabel: string
  loginLabel: string
  onLanguageChange: (lang: HomeLanguage) => void
  onToggleDarkMode: () => void
  onOpenCoinPurchase: () => void
  onVerifySubscription: () => void
  onDonate: () => void
  onOpenSettings: () => void
  onLogout: () => void
  onLogin: () => void
}

export default function HomeHeader({
  headerClasses,
  darkMode,
  user,
  userRole,
  balance,
  language,
  verifySubscriptionLabel,
  settingsLabel,
  logoutLabel,
  loginLabel,
  onLanguageChange,
  onToggleDarkMode,
  onOpenCoinPurchase,
  onVerifySubscription,
  onDonate,
  onOpenSettings,
  onLogout,
  onLogin,
}: HomeHeaderProps) {
  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:items-center">
          <div className="flex min-w-0 items-center justify-self-start">
            {user ? (
              <div className="flex items-start gap-3">
                {user.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profile_image_url}
                    alt=""
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                    className={`w-12 h-12 shrink-0 rounded-full border-2 object-cover ${darkMode ? 'border-sdhq-cyan-500' : 'border-sdhq-cyan-300'}`}
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-green-400 flex items-center justify-center">
                    <User className="w-6 h-6 text-black" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className={`font-semibold text-[110%] leading-snug ${darkMode ? 'text-white' : 'text-gray-800'}`}
                    >
                      {user.display_name}
                    </p>
                    {userRole === 'free' ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span
                          className={`text-[10px] leading-none opacity-60 ${
                            darkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          10 coins free/24hr
                        </span>
                        <button
                          type="button"
                          onClick={onOpenCoinPurchase}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                            darkMode
                              ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25'
                              : 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
                          }`}
                          title="Role and coin balance"
                        >
                          <span className="text-lg leading-none">
                            {ROLE_CONFIG[userRole]?.badge ?? '❓'}
                          </span>
                          <span className="leading-none">{ROLE_CONFIG[userRole]?.label ?? userRole}</span>
                          <span className="opacity-70">•</span>
                          <Coins className="w-4 h-4 shrink-0" />
                          <span>{balance} coins</span>
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                          darkMode
                            ? 'bg-sdhq-dark-700/60 border-sdhq-cyan-500/30 text-sdhq-cyan-300'
                            : 'bg-cyan-50 border-sdhq-cyan-200 text-sdhq-cyan-700'
                        }`}
                        title={`Role: ${ROLE_CONFIG[userRole]?.label ?? userRole}`}
                      >
                        <span className="text-lg leading-none">{ROLE_CONFIG[userRole]?.badge ?? '❓'}</span>
                        <span className="leading-none">{ROLE_CONFIG[userRole]?.label ?? userRole}</span>
                      </span>
                    )}
                  </div>
                  {userRole === 'free' ? (
                    <div className="flex flex-wrap items-center gap-2 origin-left scale-[0.95]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onVerifySubscription}
                        className={`max-w-[min(100vw-8rem,18rem)] whitespace-normal text-center leading-snug sm:max-w-none sm:whitespace-nowrap ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
                      >
                        <Shield className="w-4 h-4 mr-1 shrink-0" />
                        {verifySubscriptionLabel}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onDonate}
                        className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                      >
                        <Heart className="w-4 h-4 mr-1 shrink-0" />
                        Donate
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 origin-left scale-[0.95]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onDonate}
                        className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                      >
                        <Heart className="w-4 h-4 mr-1 shrink-0" />
                        Donate
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="flex flex-col items-center justify-center text-center min-w-0 justify-self-center px-1">
            {user && (
              <div className="flex flex-col items-center gap-2 group max-w-[min(100vw-2rem,28rem)]">
                <div
                  className={`relative p-2.5 rounded-xl transition-all duration-300 group-hover:scale-105 ${
                    darkMode
                      ? 'bg-sdhq-dark-700 shadow-lg shadow-sdhq-cyan-500/20'
                      : 'bg-white shadow-lg shadow-cyan-500/20'
                  }`}
                >
                  <Image
                    src="https://iili.io/BebhdFf.png"
                    alt="Stream Dreams logo"
                    width={64}
                    height={64}
                    className="w-16 h-16"
                  />
                </div>
                <span className="font-bold text-xl sm:text-2xl leading-tight bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 bg-clip-text text-transparent transition-all duration-300">
                  Stream Dreams Creator Corner
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end flex-wrap gap-x-3 gap-y-2 justify-self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDarkMode}
              className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as HomeLanguage)}
              className={`px-3 py-1.5 rounded-md text-base border ${
                darkMode
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white'
                  : 'bg-white border-sdhq-cyan-200 text-gray-900'
              }`}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
              <option value="de">DE</option>
            </select>
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenSettings}
                  className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  {settingsLabel}
                </Button>
                <Button variant="destructive" size="sm" onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-1" />
                  {logoutLabel}
                </Button>
              </>
            ) : (
              <Button onClick={onLogin} className="sdhq-button">
                {loginLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
