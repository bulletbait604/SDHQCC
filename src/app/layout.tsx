import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'SDHQ Creator Corner',
  description: 'Optimize long and short form content for ANY platform - Your complete content creation toolkit',
  icons: {
    icon: [
      { url: 'https://iili.io/BebhdFf.png', sizes: '32x32', type: 'image/png' },
      { url: 'https://iili.io/BebhdFf.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: 'https://iili.io/BebhdFf.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: 'https://iili.io/BebhdFf.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className={inter.className}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8352204611358668"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <div className="min-h-screen bg-gradient-to-br from-sdhq-cyan-50 via-white to-sdhq-green-50 flex flex-col">
          <Providers>
            <main className="flex-grow">
              {children}
            </main>
          <footer className="bg-gradient-to-r from-sdhq-cyan-600 to-sdhq-green-500 text-white py-4 px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-white/95">
                  {new Date().getFullYear()} SDHQ Creator Corner. All rights reserved.
                </span>
                <span className="hidden sm:inline text-white/70">|</span>
                <a href="/privacy" className="text-sm font-medium text-white/95 hover:text-white underline transition-opacity">
                  Privacy Policy
                </a>
                <span className="text-xs font-medium text-white/90 bg-white/20 px-2 py-1 rounded">
                  This site uses advertising to support free access.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white/95">Support us:</span>
                <a
                  href="https://www.paypal.com/paypalme/bulletbait604/5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-sdhq-cyan-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-sdhq-cyan-50 transition-colors flex items-center gap-2 shadow-md"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.629h6.713c2.838 0 5.098.835 5.838 2.44.61 1.336.397 2.838-.61 4.384-.983 1.51-2.587 2.537-4.655 2.943l-.034.006h.034c2.948.622 5.098 2.024 6.03 4.66.468 1.28.468 2.54.02 3.686-.92 2.4-3.194 3.725-6.665 3.868l-.034.004H7.076z"/>
                  </svg>
                  Donate
                </a>
              </div>
            </div>
          </footer>
          </Providers>
        </div>
      </body>
    </html>
  )
}
