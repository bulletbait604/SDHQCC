'use client'

interface Props {
  darkMode: boolean
  cardClasses: string
  title: string
  description: string
}

/**
 * Placeholder shell for a future main tab. Replace the body when the product
 * spec is defined; keep props/callbacks in page.tsx minimal.
 */
export default function NewToolTab({
  darkMode,
  cardClasses,
  title,
  description,
}: Props) {
  const textPrimary = darkMode ? 'text-white' : 'text-gray-900'
  const textMuted = darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'

  return (
    <div className={`relative py-8 ${cardClasses}`}>
      <div className="flex flex-col items-center text-center max-w-lg mx-auto px-4">
        <h3 className={`text-3xl font-bold ${textPrimary} mb-2`}>{title}</h3>
        <p className={`text-base ${textMuted} mb-6`}>{description}</p>
        <p
          className={
            darkMode ? 'text-gray-400 text-sm' : 'text-gray-600 text-sm'
          }
        >
          This tab is wired and ready. Describe what you want it to do next, and
          the UI and API routes can be filled in.
        </p>
      </div>
    </div>
  )
}
