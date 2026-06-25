/** Shared home shell class names (header, cards, tabs). */
export function getHomeThemeClasses(darkMode: boolean) {
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
    tabListClasses: darkMode
      ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-700 border-2 border-sdhq-cyan-500/30 shadow-xl'
      : 'bg-gradient-to-br from-white to-cyan-50 border-2 border-sdhq-cyan-300 shadow-xl',
    tabTriggerActiveClasses: darkMode
      ? 'bg-gradient-to-r from-sdhq-cyan-500/20 to-sdhq-green-500/20 text-sdhq-cyan-400 border-b-2 border-sdhq-cyan-500 shadow-lg'
      : 'bg-gradient-to-r from-sdhq-cyan-100 to-sdhq-green-100 text-sdhq-cyan-700 border-b-2 border-sdhq-cyan-500 shadow-lg',
    tabTriggerInactiveClasses: darkMode
      ? 'text-gray-400 hover:text-sdhq-cyan-300 hover:bg-sdhq-dark-700/50 border-r border-sdhq-cyan-500/20 shadow-sm'
      : 'text-gray-600 hover:text-sdhq-cyan-600 hover:bg-cyan-50/50 border-r border-sdhq-cyan-300 shadow-sm',
    textClasses: darkMode ? 'text-gray-300' : 'text-gray-600',
    subtitleClasses: darkMode ? 'text-gray-400' : 'text-gray-500',
  }
}
