import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'SDHQ Creator Corner',
  description: 'Optimize long and short form content for ANY platform - Your complete content creation toolkit',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-sdhq-cyan-50 via-white to-sdhq-green-50">
          {children}
        </div>
      </body>
    </html>
  )
}
