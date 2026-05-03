'use client'

import type { ReactNode } from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'

interface Props {
  darkMode: boolean
  cardClasses: string
}

type StreamingRow = {
  name: string
  pros: string
  cons: string
  url: string
  label: string
}

type ToolkitRow = {
  category: string
  name: string
  details: string
  url: string
}

const STREAMING_SOFTWARE: StreamingRow[] = [
  {
    name: 'OBS Studio',
    pros: 'Industry standard, powerful plugin ecosystem, low CPU usage.',
    cons: 'Steeper learning curve.',
    url: 'https://obsproject.com',
    label: 'obsproject.com',
  },
  {
    name: 'Streamlabs',
    pros: 'Fast setup, integrated widgets and alerts.',
    cons: "High resource usage; many features behind 'Ultra' paywall.",
    url: 'https://streamlabs.com',
    label: 'streamlabs.com',
  },
  {
    name: 'Meld Studio',
    pros: 'Clean UI, macOS optimized, layer-based editing feel.',
    cons: 'Newer community with fewer custom plugins.',
    url: 'https://meldstudio.com',
    label: 'meldstudio.com',
  },
  {
    name: 'Prism Live Studio',
    pros: 'Mobile/PC sync, beauty filters, and interactive stickers.',
    cons: 'Advanced audio routing is limited.',
    url: 'https://prismlive.com',
    label: 'prismlive.com',
  },
  {
    name: 'XSplit',
    pros: 'Professional scene management and premium support.',
    cons: 'Paid subscription model for high-end features.',
    url: 'https://www.xsplit.com',
    label: 'xsplit.com',
  },
]

const TOOLKIT_LINKS: ToolkitRow[] = [
  {
    category: 'Audio',
    name: 'Freesound',
    details: 'Community Creative Commons sounds — verify license per clip.',
    url: 'https://freesound.org',
  },
  {
    category: 'Audio',
    name: 'MyInstants',
    details: 'Massive soundboard of viral meme sounds and buttons.',
    url: 'https://www.myinstants.com',
  },
  {
    category: 'Audio',
    name: 'Pixabay Music',
    details: 'Royalty-free music tracks; no attribution required on Pixabay license.',
    url: 'https://pixabay.com/music/',
  },
  {
    category: 'Audio',
    name: 'Uppbeat',
    details: 'Royalty-free music with automatic YouTube clearance.',
    url: 'https://uppbeat.io',
  },
  {
    category: 'Audio',
    name: 'ZapSplat',
    details: 'Large free SFX library; free account often required.',
    url: 'https://www.zapsplat.com',
  },
  {
    category: 'Clips',
    name: 'CapCut',
    details: 'Strong choice for vertical shorts/reels with AI captions.',
    url: 'https://www.capcut.com',
  },
  {
    category: 'Editing',
    name: 'DaVinci Resolve',
    details: 'Professional NLE with a capable free tier (Blackmagic).',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
  },
  {
    category: 'Editing',
    name: 'Photopea',
    details: 'Free Photoshop-like editor in the browser.',
    url: 'https://www.photopea.com',
  },
  {
    category: 'Fonts',
    name: 'DaFont',
    details: 'Huge font archive — check each font’s license before commercial use.',
    url: 'https://www.dafont.com',
  },
  {
    category: 'Fonts',
    name: 'Google Fonts',
    details: 'Open fonts with clear licensing; easy web & download use.',
    url: 'https://fonts.google.com',
  },
  {
    category: 'GIFs',
    name: 'GIPHY',
    details: 'Primary library for animated GIFs and stickers.',
    url: 'https://giphy.com',
  },
  {
    category: 'GIFs',
    name: 'Tenor',
    details: 'GIF search integrated with many apps; good for sticker-style GIFs.',
    url: 'https://tenor.com',
  },
  {
    category: 'Quotes',
    name: 'QuoDB',
    details: 'Searchable movie quote database (great for caption ideas).',
    url: 'https://www.quodb.com',
  },
  {
    category: 'Quotes',
    name: 'Subzin',
    details: 'Find quotes by phrase across film & TV subtitles.',
    url: 'https://www.subzin.com',
  },
  {
    category: 'Stickers',
    name: 'Flaticon',
    details: 'Static & animated sticker-style assets (filter Free where needed).',
    url: 'https://www.flaticon.com',
  },
  {
    category: 'Text',
    name: 'TextStudio',
    details: '3D, neon, and specialty text generators.',
    url: 'https://www.textstudio.com',
  },
  {
    category: 'Video / B-roll',
    name: 'Mixkit',
    details: 'Free HD stock video clips and assets.',
    url: 'https://mixkit.co/free-stock-video/',
  },
  {
    category: 'Video / B-roll',
    name: 'Pexels Videos',
    details: 'High-quality stock footage (no attribution required).',
    url: 'https://www.pexels.com/videos/',
  },
  {
    category: 'Video / B-roll',
    name: 'Pixabay Videos',
    details: 'Large free footage library alongside photos.',
    url: 'https://pixabay.com/videos/',
  },
  {
    category: 'Visuals',
    name: 'Internet Archive',
    details: 'Public domain & Creative Commons film clips — filter by usage rights.',
    url: 'https://archive.org/details/moviesandfilms',
  },
  {
    category: 'Visuals',
    name: 'Pexels',
    details: 'High-quality stock photo & video (no attribution required).',
    url: 'https://www.pexels.com',
  },
  {
    category: 'Visuals',
    name: 'Vecteezy',
    details: 'PNGs and vectors — use the Free filter and check license.',
    url: 'https://www.vecteezy.com',
  },
].sort((a, b) => {
  const c = a.category.localeCompare(b.category)
  if (c !== 0) return c
  return a.name.localeCompare(b.name)
})

function LinkOut({
  href,
  children,
  darkMode,
}: {
  href: string
  children: ReactNode
  darkMode: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-medium hover:underline ${
        darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
      }`}
    >
      {children}
      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
    </a>
  )
}

export default function ResourceHubTab({ darkMode, cardClasses }: Props) {
  const h2 = `text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`
  const h3 = `text-lg font-semibold ${darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'}`
  const body = `text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`
  const muted = `text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`
  const cardInner = darkMode ? 'bg-sdhq-dark-700/50 border-sdhq-dark-600' : 'bg-cyan-50/40 border-sdhq-cyan-100'
  const th = `text-left text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-700'}`

  return (
    <div className={`py-8 px-4 sm:px-8 ${cardClasses}`}>
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-10 h-10 text-sdhq-cyan-500" />
          <div className="text-left">
            <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Resource Hub</h3>
            <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
              Master reference — May 2026 edition
            </p>
          </div>
        </div>
        <p className={`max-w-2xl ${body}`}>
          Free or free-to-use tools for fonts, stickers, audio, clips, B-roll, quotes, and streaming. Always verify
          licenses for commercial projects.
        </p>
      </div>

      {/* I. Streaming software */}
      <section className="mb-10">
        <h2 className={`${h2} mb-4 border-b pb-2 ${darkMode ? 'border-sdhq-cyan-500/30' : 'border-sdhq-cyan-200'}`}>
          I. Streaming software
        </h2>
        <div className="overflow-x-auto rounded-xl border border-inherit">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className={`${darkMode ? 'bg-sdhq-dark-700/80' : 'bg-cyan-50'}`}>
                <th className={`p-3 ${th}`}>Software</th>
                <th className={`p-3 ${th}`}>Pros / cons</th>
                <th className={`p-3 ${th}`}>Link</th>
              </tr>
            </thead>
            <tbody>
              {STREAMING_SOFTWARE.map((row) => (
                <tr
                  key={row.name}
                  className={`border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'} ${darkMode ? 'hover:bg-sdhq-dark-700/40' : 'hover:bg-cyan-50/60'}`}
                >
                  <td className={`p-3 font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{row.name}</td>
                  <td className={`p-3 ${body}`}>
                    <span className={darkMode ? 'text-sdhq-green-400/90' : 'text-sdhq-green-700'}>Pros: </span>
                    {row.pros}{' '}
                    <span className={darkMode ? 'text-orange-300/90' : 'text-orange-700'}>Cons: </span>
                    {row.cons}
                  </td>
                  <td className="p-3">
                    <LinkOut href={row.url} darkMode={darkMode}>
                      {row.label}
                    </LinkOut>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* II. Content creation toolkit */}
      <section className="mb-10">
        <h2 className={`${h2} mb-4 border-b pb-2 ${darkMode ? 'border-sdhq-cyan-500/30' : 'border-sdhq-cyan-200'}`}>
          II. Content creation toolkit
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLKIT_LINKS.map((row) => (
            <div
              key={`${row.category}-${row.name}`}
              className={`rounded-xl border p-4 transition-shadow ${cardInner} ${darkMode ? 'hover:border-sdhq-cyan-500/40' : 'hover:border-sdhq-cyan-300'}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    darkMode ? 'bg-sdhq-dark-800 text-sdhq-cyan-300' : 'bg-white text-sdhq-cyan-700 shadow-sm'
                  }`}
                >
                  {row.category}
                </span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{row.name}</span>
              </div>
              <p className={`mb-2 ${body}`}>{row.details}</p>
              <LinkOut href={row.url} darkMode={darkMode}>
                Open site
              </LinkOut>
            </div>
          ))}
        </div>
      </section>

      {/* III. Platform guide */}
      <section className="mb-6">
        <h2 className={`${h2} mb-4 border-b pb-2 ${darkMode ? 'border-sdhq-cyan-500/30' : 'border-sdhq-cyan-200'}`}>
          III. 2026 platform guide (streaming specs)
        </h2>
        <div className={`space-y-6 ${body}`}>
          <div className={`rounded-xl border p-5 ${cardInner}`}>
            <h3 className={`${h3} mb-2`}>The big three (Twitch, YouTube, Kick)</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className={darkMode ? 'text-white' : 'text-gray-900'}>Twitch:</strong> 1080p / 60fps (~6–8k
                Kbps). Affiliate: ~50 followers, 3.0 avg viewers (check current Partner/Affiliate rules).
              </li>
              <li>
                <strong className={darkMode ? 'text-white' : 'text-gray-900'}>YouTube:</strong> 1440p often ~12–18k
                Kbps. Partner: 1k subs & 4k watch hours (program rules vary).
              </li>
              <li>
                <strong className={darkMode ? 'text-white' : 'text-gray-900'}>Kick:</strong> 1080p / 60fps (8k+ Kbps
                typical). Affiliate thresholds evolve — confirm on Kick&apos;s site.
              </li>
            </ul>
          </div>

          <div className={`rounded-xl border p-5 ${cardInner}`}>
            <h3 className={`${h3} mb-2`}>Trovo (gaming / mobile)</h3>
            <p>
              Up to 1080p / 60fps (~6000 Kbps). Revenue: Trovo 500 program (tiers based on hours watched). Confirm
              eligibility on{' '}
              <LinkOut href="https://trovo.live" darkMode={darkMode}>
                trovo.live
              </LinkOut>
              .
            </p>
          </div>

          <div className={`rounded-xl border p-5 ${cardInner}`}>
            <h3 className={`${h3} mb-2`}>Rumble (news / alternative)</h3>
            <p>
              1080p / 60fps (~4000–6000 Kbps). Monetization: ad-revenue sharing and licensing — see{' '}
              <LinkOut href="https://rumble.com" darkMode={darkMode}>
                rumble.com
              </LinkOut>
              .
            </p>
          </div>

          <div className={`rounded-xl border p-5 ${cardInner}`}>
            <h3 className={`${h3} mb-2`}>TikTok Live (vertical)</h3>
            <p>
              1080p vertical (9:16). PC streaming often requires follower thresholds (commonly ~1,000 — verify in-app).
            </p>
          </div>
        </div>
      </section>

      <p className={`text-center ${muted}`}>
        Stream Dreams Creator Corner — Resource Hub reference (May 2026). Specs and partner rules change; confirm on
        each platform.
      </p>
    </div>
  )
}
