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
import { OWNER_VIEW_AS_OPTIONS, type OwnerViewAs } from '@/lib/home/ownerViewAs'

export interface HomeHeaderProps {
  headerClasses: string
  darkMode: boolean
  user: KickUser | null
  userRole: Role
  showViewAsSwitcher?: boolean
  viewAs?: OwnerViewAs
  onViewAsChange?: (viewAs: OwnerViewAs) => void
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
  showViewAsSwitcher = false,
  viewAs = 'owner',
  onViewAsChange,
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
      <div className="container mx-auto px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:items-center">
          <div className="flex min-w-0 items-center justify-self-start">
            {user ? (
              <div className="flex items-start gap-3">
                {user.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img // eslint-disable-line @next/next/no-img-element -- arbitrary Kick CDN hosts
                    
                    src={user.profile_image_url}
                    alt=""
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                  className={`w-12 h-12 shrink-0 rounded-full border-2 object-cover transition-transform duration-300 hover:scale-105 ${darkMode ? 'border-sdhq-cyan-400' : 'border-sdhq-cyan-300'}`}
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
                        className={`max-w-[min(100vw-8rem,18rem)] whitespace-normal text-center leading-snug sm:max-w-none sm:whitespace-nowrap ${darkMode ? 'border-white/15 text-white hover:bg-white/10' : ''}`}
                      >
                        <Shield className="w-4 h-4 mr-1 shrink-0" />
                        {verifySubscriptionLabel}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onDonate}
                        className={darkMode ? 'border-white/15 text-white hover:bg-white/10' : ''}
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
                        className={darkMode ? 'border-white/15 text-white hover:bg-white/10' : ''}
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
              <div className="flex flex-col items-center gap-1.5 group max-w-[min(100vw-2rem,28rem)]">
                <div
                  className={`relative overflow-hidden rounded-2xl bg-black shadow-lg transition-all duration-300 group-hover:scale-105 ${
                    darkMode ? 'shadow-sdhq-cyan-500/25' : 'shadow-cyan-500/25 ring-1 ring-black/10'
                  }`}
                >
                  <Image
                    src="/sdhq-header-logo.png"
                    alt="Stream Dreams logo"
                    width={240}
                    height={161}
                    priority
                    className="h-20 w-[7.5rem] object-contain p-1 sm:h-[5.5rem] sm:w-[8.2rem]"
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
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={darkMode ? 'border-white/15 text-white hover:bg-white/10' : ''}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as HomeLanguage)}
              className={`px-3 py-1.5 rounded-xl text-base border transition-all ${
                darkMode
                  ? 'bg-sdhq-dark-800/80 border-white/15 text-white hover:border-sdhq-cyan-400'
                  : 'bg-white border-sdhq-cyan-200 text-gray-900 hover:border-sdhq-cyan-400'
              }`}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
              <option value="de">DE</option>
            </select>
            {showViewAsSwitcher && onViewAsChange ? (
              <label className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`hidden text-xs font-semibold uppercase tracking-wide sm:inline ${
                    darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'
                  }`}
                >
                  View as
                </span>
                <select
                  value={viewAs}
                  onChange={(e) => onViewAsChange(e.target.value as OwnerViewAs)}
                  title="Preview the site as a regular user or subscriber. Tools still run as owner."
                  className={`max-w-[9.5rem] rounded-xl border px-3 py-1.5 text-base transition-all ${
                    darkMode
                      ? 'bg-sdhq-dark-800/80 border-white/15 text-white hover:border-sdhq-cyan-400'
                      : 'bg-white border-sdhq-cyan-200 text-gray-900 hover:border-sdhq-cyan-400'
                  }`}
                >
                  {OWNER_VIEW_AS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenSettings}
                  className={darkMode ? 'border-white/15 text-white hover:bg-white/10' : ''}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  {settingsLabel}
                </Button>
                <Button variant="destructive" size="sm" onClick={onLogout} title={logoutLabel}>
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
