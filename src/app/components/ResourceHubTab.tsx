'use client'

import { useState, type ReactNode } from 'react'
import { BookOpen, ExternalLink, MonitorPlay, Radio, Wrench } from 'lucide-react'
import AlgorithmInsightsSection, {
  type AlgorithmInsightsSectionProps,
} from '@/app/components/AlgorithmInsightsSection'

interface Props extends AlgorithmInsightsSectionProps {
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

type ToolkitSectionId =
  | 'audio'
  | 'video'
  | 'graphics'
  | 'photos'
  | 'quotes'
  | 'editing'

type ToolkitRow = {
  /** Fine-grained tag shown on each card */
  category: string
  sectionId: ToolkitSectionId
  name: string
  details: string
  url: string
}

const TOOLKIT_SECTION_META: Record<
  ToolkitSectionId,
  { title: string; subtitle: string }
> = {
  audio: {
    title: 'Audio & sound',
    subtitle: 'Music beds, SFX, soundboards — check licenses for monetized uploads.',
  },
  video: {
    title: 'Video, clips & B-roll',
    subtitle: 'Short-form editors, stock footage, and background clips.',
  },
  graphics: {
    title: 'Fonts, stickers, GIFs & text',
    subtitle: 'Typography, sticker-style assets, animated GIFs, and stylized titles.',
  },
  photos: {
    title: 'Photos, vectors & archives',
    subtitle: 'Still imagery, vectors, and rights-filtered archival clips.',
  },
  quotes: {
    title: 'Movie quotes & dialogue',
    subtitle: 'Look up lines for captions, jokes, or reaction edits.',
  },
  editing: {
    title: 'Editing & compositing',
    subtitle: 'Desktop NLE and browser compositing — stronger tools, steeper learning curves.',
  },
}

const TOOLKIT_SECTION_ORDER: ToolkitSectionId[] = [
  'audio',
  'video',
  'graphics',
  'photos',
  'quotes',
  'editing',
]

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

const STREAMING_SPECS = [
  {
    name: 'Twitch',
    resolution: '1080p / 60fps',
    bitrate: '~6–8k Kbps',
    notes: 'Affiliate often ~50 followers and 3.0 avg viewers — confirm current rules.',
  },
  {
    name: 'YouTube',
    resolution: 'Up to 1440p',
    bitrate: '~12–18k Kbps',
    notes: 'Partner program often 1k subs and 4k watch hours — rules vary.',
  },
  {
    name: 'Kick',
    resolution: '1080p / 60fps',
    bitrate: '8k+ Kbps typical',
    notes: 'Affiliate thresholds change — check Kick’s site.',
  },
  {
    name: 'Trovo',
    resolution: '1080p / 60fps',
    bitrate: '~6000 Kbps',
    notes: 'Trovo 500 program pays by hours watched. Confirm on trovo.live.',
    url: 'https://trovo.live',
  },
  {
    name: 'Rumble',
    resolution: '1080p / 60fps',
    bitrate: '~4000–6000 Kbps',
    notes: 'Ads and licensing. See rumble.com.',
    url: 'https://rumble.com',
  },
  {
    name: 'TikTok Live',
    resolution: '1080p vertical (9:16)',
    bitrate: 'App-managed',
    notes: 'PC streaming often needs ~1,000 followers — verify in-app.',
  },
] as const

const TOOLKIT_LINKS: ToolkitRow[] = ([
  {
    category: 'Audio',
    sectionId: 'audio',
    name: 'Freesound',
    details: 'Community Creative Commons sounds — verify license per clip.',
    url: 'https://freesound.org',
  },
  {
    category: 'Audio',
    sectionId: 'audio',
    name: 'MyInstants',
    details: 'Massive soundboard of viral meme sounds and buttons.',
    url: 'https://www.myinstants.com',
  },
  {
    category: 'Audio',
    sectionId: 'audio',
    name: 'Pixabay Music',
    details: 'Royalty-free music tracks; no attribution required on Pixabay license.',
    url: 'https://pixabay.com/music/',
  },
  {
    category: 'Audio',
    sectionId: 'audio',
    name: 'Uppbeat',
    details: 'Royalty-free music with automatic YouTube clearance.',
    url: 'https://uppbeat.io',
  },
  {
    category: 'Audio',
    sectionId: 'audio',
    name: 'ZapSplat',
    details: 'Large free SFX library; free account often required.',
    url: 'https://www.zapsplat.com',
  },
  {
    category: 'Clips',
    sectionId: 'video',
    name: 'CapCut',
    details: 'Strong choice for vertical shorts/reels with AI captions.',
    url: 'https://www.capcut.com',
  },
  {
    category: 'Editing',
    sectionId: 'editing',
    name: 'DaVinci Resolve',
    details: 'Professional NLE with a capable free tier (Blackmagic).',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
  },
  {
    category: 'Editing',
    sectionId: 'editing',
    name: 'Photopea',
    details: 'Free Photoshop-like editor in the browser.',
    url: 'https://www.photopea.com',
  },
  {
    category: 'Fonts',
    sectionId: 'graphics',
    name: 'DaFont',
    details: 'Huge font archive — check each font’s license before commercial use.',
    url: 'https://www.dafont.com',
  },
  {
    category: 'Fonts',
    sectionId: 'graphics',
    name: 'Google Fonts',
    details: 'Open fonts with clear licensing; easy web & download use.',
    url: 'https://fonts.google.com',
  },
  {
    category: 'GIFs',
    sectionId: 'graphics',
    name: 'GIPHY',
    details: 'Primary library for animated GIFs and stickers.',
    url: 'https://giphy.com',
  },
  {
    category: 'GIFs',
    sectionId: 'graphics',
    name: 'Tenor',
    details: 'GIF search integrated with many apps; good for sticker-style GIFs.',
    url: 'https://tenor.com',
  },
  {
    category: 'Quotes',
    sectionId: 'quotes',
    name: 'QuoDB',
    details: 'Searchable movie quote database (great for caption ideas).',
    url: 'https://www.quodb.com',
  },
  {
    category: 'Quotes',
    sectionId: 'quotes',
    name: 'Subzin',
    details: 'Find quotes by phrase across film & TV subtitles.',
    url: 'https://www.subzin.com',
  },
  {
    category: 'Stickers',
    sectionId: 'graphics',
    name: 'Flaticon',
    details: 'Static & animated sticker-style assets (filter Free where needed).',
    url: 'https://www.flaticon.com',
  },
  {
    category: 'Text',
    sectionId: 'graphics',
    name: 'TextStudio',
    details: '3D, neon, and specialty text generators.',
    url: 'https://www.textstudio.com',
  },
  {
    category: 'Video / B-roll',
    sectionId: 'video',
    name: 'Mixkit',
    details: 'Free HD stock video clips and assets.',
    url: 'https://mixkit.co/free-stock-video/',
  },
  {
    category: 'Video / B-roll',
    sectionId: 'video',
    name: 'Pexels Videos',
    details: 'High-quality stock footage (no attribution required).',
    url: 'https://www.pexels.com/videos/',
  },
  {
    category: 'Video / B-roll',
    sectionId: 'video',
    name: 'Pixabay Videos',
    details: 'Large free footage library alongside photos.',
    url: 'https://pixabay.com/videos/',
  },
  {
    category: 'Visuals',
    sectionId: 'photos',
    name: 'Internet Archive',
    details: 'Public domain & Creative Commons film clips — filter by usage rights.',
    url: 'https://archive.org/details/moviesandfilms',
  },
  {
    category: 'Visuals',
    sectionId: 'photos',
    name: 'Pexels',
    details: 'High-quality stock photo & video (no attribution required).',
    url: 'https://www.pexels.com',
  },
  {
    category: 'Visuals',
    sectionId: 'photos',
    name: 'Vecteezy',
    details: 'PNGs and vectors — use the Free filter and check license.',
    url: 'https://www.vecteezy.com',
  },
] as ToolkitRow[]).sort((a, b) => {
  const si = TOOLKIT_SECTION_ORDER.indexOf(a.sectionId)
  const sj = TOOLKIT_SECTION_ORDER.indexOf(b.sectionId)
  if (si !== sj) return si - sj
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

export default function ResourceHubTab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  platforms,
  platformsBannerLogos,
  lastUpdated,
  isLoadingAlgorithms,
  algorithmError,
  isAdmin,
  showAdminControls,
  onRefreshAlgorithms,
  expandedCard,
  onExpandedCardChange,
}: Props) {
  const h2 = `text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`
  const body = `text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`
  const muted = `text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`
  const cardInner = darkMode ? 'bg-sdhq-dark-700/50 border-sdhq-dark-600' : 'bg-cyan-50/40 border-sdhq-cyan-100'
  const sectionDivider = `my-12 border-t-2 ${darkMode ? 'border-sdhq-cyan-500/25' : 'border-sdhq-cyan-200'}`
  const [toolkitSection, setToolkitSection] = useState<ToolkitSectionId>('audio')
  const toolkitItems = TOOLKIT_LINKS.filter((row) => row.sectionId === toolkitSection)
  const toolkitMeta = TOOLKIT_SECTION_META[toolkitSection]

  return (
    <div className={`py-8 px-4 sm:px-8 ${cardClasses}`}>
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-10 h-10 text-sdhq-cyan-500" />
          <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Resource Hub</h3>
        </div>
      </div>

      <AlgorithmInsightsSection
        darkMode={darkMode}
        textClasses={textClasses}
        subtitleClasses={subtitleClasses}
        platforms={platforms}
        platformsBannerLogos={platformsBannerLogos}
        lastUpdated={lastUpdated}
        isLoadingAlgorithms={isLoadingAlgorithms}
        algorithmError={algorithmError}
        isAdmin={isAdmin}
        showAdminControls={showAdminControls}
        onRefreshAlgorithms={onRefreshAlgorithms}
        expandedCard={expandedCard}
        onExpandedCardChange={onExpandedCardChange}
      />

      <hr className={sectionDivider} />

      <section>
        <div className="mb-8">
          <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Tools & streaming specs
          </h3>
          <p className={`mt-2 max-w-2xl ${body}`}>
            Pick a category, skim the cards, and open only what you need. Always check licenses before using assets
            on monetized streams.
          </p>
        </div>

        <section className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-sdhq-cyan-400" />
            <h2 className={h2}>Streaming software</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {STREAMING_SOFTWARE.map((row) => (
              <article
                key={row.name}
                className={`rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${cardInner} ${
                  darkMode ? 'hover:border-sdhq-cyan-400/40' : 'hover:border-sdhq-cyan-300'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{row.name}</h3>
                  <LinkOut href={row.url} darkMode={darkMode}>
                    {row.label}
                  </LinkOut>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        darkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      Pro
                    </span>
                    <span className={body}>{row.pros}</span>
                  </p>
                  <p className="flex gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        darkMode ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      Con
                    </span>
                    <span className={body}>{row.cons}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-sdhq-cyan-400" />
            <h2 className={h2}>Content toolkit</h2>
          </div>
          <p className={`mb-4 ${body}`}>Choose a category to keep the list short. Check licenses before commercial use.</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {TOOLKIT_SECTION_ORDER.map((sectionId) => {
              const active = toolkitSection === sectionId
              return (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => setToolkitSection(sectionId)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-sdhq-cyan-500 text-sdhq-dark-900 shadow-md'
                      : darkMode
                        ? 'bg-sdhq-dark-700 text-gray-300 hover:bg-sdhq-dark-600'
                        : 'bg-white text-gray-700 shadow-sm hover:bg-cyan-50'
                  }`}
                >
                  {TOOLKIT_SECTION_META[sectionId].title}
                </button>
              )
            })}
          </div>
          <p className={`mb-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{toolkitMeta.subtitle}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {toolkitItems.map((row) => (
              <div
                key={`${row.category}-${row.name}`}
                className={`rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${cardInner} ${
                  darkMode ? 'hover:border-sdhq-cyan-400/50' : 'hover:border-sdhq-cyan-300 hover:shadow-cyan-100'
                }`}
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

        <section className="mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5 text-sdhq-cyan-400" />
            <h2 className={h2}>Streaming specs</h2>
          </div>
          <p className={`mb-4 ${body}`}>Quick targets only — partner rules change, so confirm on each platform.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STREAMING_SPECS.map((spec) => (
              <article key={spec.name} className={`rounded-2xl border p-4 ${cardInner}`}>
                <h3 className={`mb-3 text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{spec.name}</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className={muted}>Resolution</dt>
                    <dd className={`text-right font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {spec.resolution}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className={muted}>Bitrate</dt>
                    <dd className={`text-right font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {spec.bitrate}
                    </dd>
                  </div>
                  <div>
                    <dt className={`mb-1 ${muted}`}>Notes</dt>
                    <dd className={body}>
                      {spec.notes}
                      {'url' in spec && spec.url ? (
                        <>
                          {' '}
                          <LinkOut href={spec.url} darkMode={darkMode}>
                            Open site
                          </LinkOut>
                        </>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

      <p className={`text-center ${muted}`}>
        Stream Dreams Creator Corner — Resource Hub reference (May 2026). Specs and partner rules change; confirm on
        each platform.
      </p>
      </section>
    </div>
  )
}
