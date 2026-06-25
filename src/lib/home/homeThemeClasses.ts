/** Shared home shell class names (header, cards, tabs). */
export function getHomeThemeClasses(darkMode: boolean) {
  /** Logo cyan (#008b99 / sdhq-cyan-700) bar — high contrast labels, no white wash. */
  const tabListClasses = darkMode
    ? 'bg-sdhq-dark-800 border-2 border-sdhq-cyan-500/40 shadow-xl p-1'
    : 'bg-sdhq-cyan-700 border-2 border-sdhq-cyan-500 shadow-xl p-1'

  /** Full trigger classes (must stay literal strings for Tailwind JIT). */
  const tabTriggerClasses = darkMode
    ? 'text-sdhq-cyan-100/90 hover:text-white hover:bg-sdhq-cyan-500/15 border-r border-sdhq-cyan-500/25 last:border-r-0 data-[state=active]:bg-sdhq-cyan-500/30 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-sdhq-cyan-400 data-[state=active]:shadow-md rounded-md'
    : 'text-sdhq-cyan-50 hover:text-white hover:bg-sdhq-cyan-600/50 border-r border-sdhq-cyan-500/35 last:border-r-0 data-[state=active]:bg-sdhq-cyan-500 data-[state=active]:text-sdhq-dark-900 data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-sdhq-green-500 data-[state=active]:shadow-md rounded-md'

  const createSubTabListClasses = darkMode
    ? 'bg-sdhq-dark-800 border border-sdhq-cyan-500/40'
    : 'bg-sdhq-cyan-700 border border-sdhq-cyan-500'

  return {
    themeClasses: darkMode
      ? 'min-h-screen bg-black text-white'
      : 'min-h-screen bg-gradient-to-br from-cyan-50 to-green-50',
    headerClasses: darkMode
      ? 'bg-gradient-to-r from-sdhq-dark-800 via-sdhq-dark-800 to-sdhq-dark-700/90 backdrop-blur-xl border-b border-sdhq-cyan-500/30 shadow-2xl'
      : 'bg-gradient-to-r from-white via-white to-cyan-50/80 backdrop-blur-xl border-b border-sdhq-cyan-300 shadow-2xl',
    cardClasses: darkMode
      ? 'bg-sdhq-dark-800/90 border border-sdhq-dark-700 rounded-xl shadow-lg'
      : 'bg-white/80 backdrop-blur-sm border border-sdhq-cyan-200 rounded-xl shadow-lg',
    tabListClasses,
    tabTriggerClasses,
    createSubTabListClasses,
    textClasses: darkMode ? 'text-gray-300' : 'text-gray-600',
    subtitleClasses: darkMode ? 'text-gray-400' : 'text-gray-500',
  }
}
