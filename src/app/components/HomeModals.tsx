'use client'

import { Button } from '@/components/ui/button'
import { Crown, Sun, Moon, Trash2, X } from 'lucide-react'
import type { HomeLanguage } from '@/lib/home/types'

interface ModalShellProps {
  darkMode: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}

function ModalShell({ darkMode, title, onClose, children, maxWidth = 'max-w-md' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl ${maxWidth} w-full p-6 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PrivacyPolicyModal({
  darkMode,
  title,
  onClose,
}: {
  darkMode: boolean
  title: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button type="button" onClick={onClose} className={`p-1 rounded-full ${darkMode ? 'text-white' : 'text-gray-600'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={`space-y-4 text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <section>
            <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>1. Information We Collect</h4>
            <p>We collect information you provide directly to us when you create an account, including your Kick username, profile picture, and email address.</p>
          </section>
          <section>
            <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>2. How We Use Your Information</h4>
            <p>We use your information to provide AI-powered content analysis services and personalize your experience.</p>
          </section>
          <section>
            <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>3. Data Security</h4>
            <p>We implement appropriate measures to protect your personal information.</p>
          </section>
          <section>
            <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>4. Third-Party Services</h4>
            <p>We use Kick OAuth for authentication. Your use of Kick is subject to Kick&apos;s policies.</p>
          </section>
          <section>
            <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>5. Your Rights</h4>
            <p>You can access, update, or delete your account information by contacting us.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function TermsOfServiceModal({
  darkMode,
  title,
  onClose,
}: {
  darkMode: boolean
  title: string
  onClose: () => void
}) {
  const sections = [
    ['1. Acceptance of Terms', 'By using Stream Dreams Creator Corner, you agree to these Terms of Service.'],
    ['2. Description of Service', 'We provide AI-powered content analysis tools for creators.'],
    ['3. User Accounts', 'You must authenticate through Kick and are responsible for your account security.'],
    ['4. Subscription and Payments', 'Some features require subscription; free features remain available to all users.'],
    ['5. Content Analysis', 'You grant us permission to process content data to generate recommendations.'],
    ['6. Limitation of Liability', 'AI recommendations do not guarantee specific results.'],
    ['7. Termination', 'We may suspend accounts for terms violations.'],
  ] as const

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button type="button" onClick={onClose} className={`p-1 rounded-full ${darkMode ? 'text-white' : 'text-gray-600'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={`space-y-4 text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{heading}</h4>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsQuickModal({
  darkMode,
  settingsTitle,
  languageLabel,
  darkModeLabel,
  lightModeLabel,
  language,
  onLanguageChange,
  onToggleDarkMode,
  onClose,
  showLifetimePass,
  lifetimeLocalPrice,
  checkoutCurrency,
  onLifetimePassCheckout,
}: {
  darkMode: boolean
  settingsTitle: string
  languageLabel: string
  darkModeLabel: string
  lightModeLabel: string
  language: HomeLanguage
  onLanguageChange: (lang: HomeLanguage) => void
  onToggleDarkMode: () => void
  onClose: () => void
  showLifetimePass: boolean
  lifetimeLocalPrice: number
  checkoutCurrency: string
  onLifetimePassCheckout: () => void
}) {
  return (
    <ModalShell darkMode={darkMode} title={settingsTitle} onClose={onClose}>
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{languageLabel}</span>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as HomeLanguage)}
              className={`px-3 py-1 rounded border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
        <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{darkMode ? darkModeLabel : lightModeLabel}</span>
            <Button variant="outline" size="sm" onClick={onToggleDarkMode} className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}>
              {darkMode ? <Sun className="w-4 h-4 mr-1" /> : <Moon className="w-4 h-4 mr-1" />}
              {darkMode ? lightModeLabel : darkModeLabel}
            </Button>
          </div>
        </div>
        {showLifetimePass && (
          <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
            <h4 className={`font-semibold mb-3 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <Crown className="w-4 h-4 mr-2 text-sdhq-cyan-500" />
              Lifetime Pass
            </h4>
            <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              One-time payment of {lifetimeLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })}
              {checkoutCurrency !== 'CAD' ? ' (base $89.99 CAD)' : ''}.
            </p>
            <Button onClick={onLifetimePassCheckout} className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black">
              <Crown className="w-4 h-4 mr-2" />
              Get Lifetime Pass
            </Button>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export function ClearActivityLogModal({
  darkMode,
  onConfirm,
  onCancel,
}: {
  darkMode: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ModalShell darkMode={darkMode} title="Clear Activity Log?" onClose={onCancel} maxWidth="max-w-sm">
      <p className={`text-base mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Are you sure you want to clear all activity log entries? This action cannot be undone.
      </p>
      <div className="flex space-x-2">
        <Button variant="destructive" onClick={onConfirm} className="flex-1">
          <Trash2 className="w-4 h-4 mr-2" />
          Yes, Clear
        </Button>
        <Button variant="outline" onClick={onCancel} className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}>
          Cancel
        </Button>
      </div>
    </ModalShell>
  )
}

export function VerificationWaitModal({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-sm w-full p-8 shadow-2xl text-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sdhq-cyan-500 mx-auto mb-4" />
        <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Please Wait...</h3>
        <p className={`text-base mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Verifying your payment and activating your account. This may take up to 2 minutes.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    </div>
  )
}
