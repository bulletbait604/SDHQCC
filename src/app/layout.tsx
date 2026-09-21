import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'Stream Dreams Creator Corner',
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
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col bg-transparent">
          <Providers>
            <main className="flex-grow">
              {children}
            </main>
          </Providers>
        </div>
        <Script
          id="google-adsense"
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8352204611358668"
          crossOrigin="anonymous"
        />
        <Analytics />
      </body>
    </html>
  )
}
