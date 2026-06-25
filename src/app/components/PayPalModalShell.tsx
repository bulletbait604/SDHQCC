'use client'

import { X } from 'lucide-react'

export default function PayPalModalShell({
  darkMode,
  title,
  onClose,
  children,
}: {
  darkMode: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4 py-8">
        <div
          className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} w-full max-w-md max-h-[min(90vh,100dvh-2rem)] overflow-y-auto rounded-xl p-6 shadow-2xl`}
        >
          <div className="flex items-center justify-between mb-4">
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
    </div>
  )
}
