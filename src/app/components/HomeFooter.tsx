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
      className={`relative mt-6 border-t ${
        darkMode
          ? 'border-white/10 bg-sdhq-dark-900/80'
          : 'border-sdhq-cyan-200 bg-white/80'
      }`}
    >
      <div
        className={`h-1 w-full bg-gradient-to-r from-sdhq-cyan-500 via-violet-400 to-sdhq-green-500`}
      />
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {footerCopyright}
            </p>
            <p className={`mt-1 text-sm ${darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'}`}>
              {footerTagline}
            </p>
            <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              We use ads to keep this service free. Subscribe to remove them.
            </p>
            <p className={`mt-1 text-sm font-medium ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
              Support: Bulletbait604@gmail.com
            </p>
            <a
              href="https://www.paypal.com/paypalme/bulletbait604/5"
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                darkMode
                  ? 'bg-sdhq-cyan-500/15 text-sdhq-cyan-200 hover:bg-sdhq-cyan-500/25'
                  : 'bg-sdhq-cyan-100 text-sdhq-cyan-800 hover:bg-sdhq-cyan-200'
              }`}
            >
              Donate
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/pricing"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                darkMode
                  ? 'bg-white/5 text-sdhq-cyan-300 hover:bg-white/10'
                  : 'border border-sdhq-cyan-300 bg-white text-sdhq-cyan-800 hover:bg-cyan-50 shadow-sm'
              }`}
            >
              Pricing
            </a>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                darkMode
                  ? 'bg-white/5 text-sdhq-cyan-300 hover:bg-white/10'
                  : 'border border-sdhq-cyan-300 bg-white text-sdhq-cyan-800 hover:bg-cyan-50 shadow-sm'
              }`}
            >
              {privacyPolicyLabel}
            </button>
            <button
              type="button"
              onClick={onOpenTerms}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                darkMode
                  ? 'bg-white/5 text-sdhq-cyan-300 hover:bg-white/10'
                  : 'border border-sdhq-cyan-300 bg-white text-sdhq-cyan-800 hover:bg-cyan-50 shadow-sm'
              }`}
            >
              {termsLabel}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
