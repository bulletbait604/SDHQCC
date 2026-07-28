'use client'

import type { ClipLayoutTemplate } from '@/lib/clip-editor/types'

type LayoutOption = {
  value: ClipLayoutTemplate
  label: string
  help: string
}

function LayoutMockup({
  layout,
  selected,
  darkMode,
}: {
  layout: ClipLayoutTemplate
  selected: boolean
  darkMode: boolean
}) {
  const frame = selected
    ? 'border-sdhq-cyan-500 ring-2 ring-sdhq-cyan-500/40'
    : darkMode
      ? 'border-sdhq-dark-500'
      : 'border-gray-300'
  const screen = darkMode ? 'bg-sdhq-dark-900' : 'bg-slate-800'
  const accent = 'bg-sdhq-cyan-400'
  const muted = darkMode ? 'bg-sdhq-dark-600' : 'bg-slate-600'
  const face = 'bg-amber-300'
  const game = 'bg-emerald-500/80'

  return (
    <div
      className={`mx-auto h-[118px] w-[72px] rounded-[10px] border-2 p-[3px] ${frame} ${
        darkMode ? 'bg-sdhq-dark-800' : 'bg-gray-100'
      }`}
      aria-hidden
    >
      <div className={`relative h-full w-full overflow-hidden rounded-[6px] ${screen}`}>
        {layout === 'auto' && (
          <>
            <div className={`absolute inset-x-1 top-1 h-5 rounded ${accent} opacity-70`} />
            <div className={`absolute inset-x-2 top-8 bottom-8 rounded ${muted}`} />
            <div className="absolute bottom-2 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-white/50" />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-wide text-white/80">
              Auto
            </span>
          </>
        )}
        {layout === 'stackedFacecam' && (
          <>
            <div className={`absolute inset-x-0 top-0 h-[38%] ${face}`} />
            <div className={`absolute inset-x-0 bottom-0 h-[62%] ${game}`} />
            <div className="absolute left-1/2 top-[18%] h-4 w-4 -translate-x-1/2 rounded-full bg-amber-100" />
          </>
        )}
        {layout === 'pictureInPicture' && (
          <>
            <div className={`absolute inset-0 ${game}`} />
            <div
              className={`absolute bottom-1.5 right-1.5 h-7 w-7 rounded-md border border-white/40 ${face}`}
            />
            <div className="absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full bg-amber-100" />
          </>
        )}
        {layout === 'focusCrop' && (
          <>
            <div className={`absolute inset-0 ${muted}`} />
            <div className="absolute left-1/2 top-[28%] h-10 w-10 -translate-x-1/2 rounded-full bg-amber-200" />
            <div className="absolute inset-x-3 bottom-3 h-2 rounded bg-white/40" />
          </>
        )}
        {layout === 'splitScreen' && (
          <>
            <div className={`absolute inset-y-0 left-0 w-1/2 ${face}`} />
            <div className={`absolute inset-y-0 right-0 w-1/2 ${game}`} />
            <div className="absolute left-[22%] top-[30%] h-3.5 w-3.5 rounded-full bg-amber-100" />
          </>
        )}
        {layout === 'fullFrame' && (
          <>
            <div className="absolute inset-y-[18%] inset-x-0 bg-slate-500" />
            <div className={`absolute inset-x-0 top-0 h-[18%] ${darkMode ? 'bg-black' : 'bg-black'}`} />
            <div className={`absolute inset-x-0 bottom-0 h-[18%] bg-black`} />
          </>
        )}
      </div>
    </div>
  )
}

export default function ClipLayoutPicker({
  options,
  value,
  onChange,
  disabled,
  darkMode,
  subtitleClasses,
}: {
  options: LayoutOption[]
  value: ClipLayoutTemplate
  onChange: (v: ClipLayoutTemplate) => void
  disabled?: boolean
  darkMode: boolean
  subtitleClasses: string
}) {
  return (
    <div className="space-y-2 text-left">
      <p className={`text-sm font-semibold ${subtitleClasses}`}>Clip layout (horizontal → vertical)</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-2.5 py-2.5 text-left transition ${
                selected
                  ? darkMode
                    ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/10'
                    : 'border-sdhq-cyan-500 bg-sdhq-cyan-50'
                  : darkMode
                    ? 'border-sdhq-dark-600 bg-sdhq-dark-900/60 hover:border-sdhq-cyan-500/40'
                    : 'border-gray-200 bg-white hover:border-sdhq-cyan-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <LayoutMockup layout={option.value} selected={selected} darkMode={darkMode} />
              <p
                className={`mt-2 text-center text-xs font-semibold leading-tight ${
                  darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                {option.label}
              </p>
              <p className={`mt-0.5 text-center text-[10px] leading-snug ${subtitleClasses}`}>
                {option.help}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
