/** Shared home shell class names (header, cards, tabs). */
export function getHomeThemeClasses(darkMode: boolean) {
  const tabListClasses = darkMode
    ? 'bg-sdhq-dark-800/80 border border-white/10 shadow-xl shadow-black/20 p-1.5 rounded-2xl backdrop-blur-xl'
    : 'bg-white/80 border border-sdhq-cyan-200/80 shadow-xl shadow-cyan-200/40 p-1.5 rounded-2xl backdrop-blur-xl'

  const tabTriggerClasses = darkMode
    ? 'rounded-xl text-sdhq-cyan-100/80 hover:text-white hover:bg-white/5 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sdhq-cyan-500 data-[state=active]:to-sdhq-green-500 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-lg data-[state=active]:shadow-sdhq-cyan-500/20'
    : 'rounded-xl text-slate-600 hover:text-slate-900 hover:bg-sdhq-cyan-50 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sdhq-cyan-500 data-[state=active]:to-sdhq-green-500 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-md'

  const createSubTabListClasses = darkMode
    ? 'bg-sdhq-dark-900/70 border border-white/10 rounded-2xl'
    : 'bg-cyan-50/80 border border-sdhq-cyan-200 rounded-2xl'

  return {
    themeClasses: darkMode
      ? 'relative min-h-screen bg-[#05070d] text-white'
      : 'relative min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50',
    headerClasses: darkMode
      ? 'sticky top-0 z-40 bg-sdhq-dark-900/75 backdrop-blur-2xl border-b border-white/10 shadow-lg shadow-black/20'
      : 'sticky top-0 z-40 bg-white/75 backdrop-blur-2xl border-b border-sdhq-cyan-200/70 shadow-lg shadow-cyan-100/50',
    cardClasses: darkMode
      ? 'bg-sdhq-dark-800/70 border border-white/10 rounded-2xl shadow-xl shadow-black/20 backdrop-blur-xl'
      : 'bg-white/85 backdrop-blur-xl border border-sdhq-cyan-100 rounded-2xl shadow-xl shadow-cyan-100/60',
    tabPanelClasses: 'p-4 sm:p-5',
    tabListClasses,
    tabTriggerClasses,
    createSubTabListClasses,
    textClasses: darkMode ? 'text-gray-300' : 'text-gray-600',
    subtitleClasses: darkMode ? 'text-gray-400' : 'text-gray-500',
  }
}
