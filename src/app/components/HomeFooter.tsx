'use client'

export interface HomeFooterProps {
  darkMode: boolean
  footerCopyright: string
  footerTagline: string
  privacyPolicyLabel: string
  termsLabel: string
  onOpenPrivacy: () => void
  onOpenTerms: () => void
}

export default function HomeFooter({
  darkMode,
  footerCopyright,
  footerTagline,
  privacyPolicyLabel,
  termsLabel,
  onOpenPrivacy,
  onOpenTerms,
}: HomeFooterProps) {
  return (
    <footer
      className={`border-t-2 ${darkMode ? 'border-sdhq-cyan-500 bg-gradient-to-r from-sdhq-dark-800 via-sdhq-dark-700 to-sdhq-dark-800' : 'border-sdhq-green-500 bg-gradient-to-r from-sdhq-cyan-50 via-white to-sdhq-cyan-50'} mt-8`}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="text-center md:text-left">
            <p className={`text-base font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {footerCopyright}
            </p>
            <p className={`text-sm mt-1 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
              {footerTagline}
            </p>
            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              We use ads to keep this service free. Subscribe to remove them.
            </p>
            <p
              className={`text-sm mt-1 font-medium ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}
            >
              Support: Bulletbait604@gmail.com
            </p>
          </div>
          <div className="flex space-x-6">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className={`text-base font-semibold hover:underline transition-colors ${darkMode ? 'text-sdhq-cyan-400 hover:text-sdhq-cyan-300' : 'text-sdhq-cyan-600 hover:text-sdhq-cyan-700'}`}
            >
              {privacyPolicyLabel}
            </button>
            <button
              type="button"
              onClick={onOpenTerms}
              className={`text-base font-semibold hover:underline transition-colors ${darkMode ? 'text-sdhq-cyan-400 hover:text-sdhq-cyan-300' : 'text-sdhq-cyan-600 hover:text-sdhq-cyan-700'}`}
            >
              {termsLabel}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
