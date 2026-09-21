'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ExternalLink,
  GraduationCap,
  Home,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
  Gift,
  Trophy,
  Users,
  Video,
  Wand2,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { KickUser } from '@/lib/home/types'
import type { KickChannelSnapshot, KickClipCard } from '@/lib/kick/channelSnapshot'
import type { ChannelInsights } from '@/lib/home/channelInsightsTypes'
import { emptyKickLeaderboard, type KickLeaderboard, type KickLeaderboardPeriod } from '@/lib/kick/leaderboard'
import type { useClipAnalyzer } from '@/hooks/useClipAnalyzer'

type ClipAnalyzer = ReturnType<typeof useClipAnalyzer>

type Props = {
  user: KickUser
  darkMode: boolean
  cardClasses: string
  tabPanelClasses: string
  clipAnalyzer: ClipAnalyzer
  hasUnlimitedAccess: boolean
  onOpenTab?: (tab: string) => void
}

const INITIAL_CLIPS = 5
const PAGE_SIZE = 25

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function defaultBoardPeriod(board: KickLeaderboardPeriod): 'week' | 'month' | 'lifetime' {
  if (board.week.length) return 'week'
  if (board.month.length) return 'month'
  return 'lifetime'
}

function rowsForPeriod(board: KickLeaderboardPeriod, period: 'week' | 'month' | 'lifetime') {
  return period === 'week' ? board.week : period === 'month' ? board.month : board.lifetime
}

export default function HomeDashboardTab({
  user,
  darkMode,
  cardClasses,
  tabPanelClasses,
  clipAnalyzer,
  hasUnlimitedAccess,
  onOpenTab,
}: Props) {
  const [channel, setChannel] = useState<KickChannelSnapshot | null>(null)
  const [leaderboard, setLeaderboard] = useState<KickLeaderboard>(emptyKickLeaderboard)
  const [giftedPeriod, setGiftedPeriod] = useState<'week' | 'month' | 'lifetime'>('week')
  const [kicksPeriod, setKicksPeriod] = useState<'week' | 'month' | 'lifetime'>('week')
  const [channelError, setChannelError] = useState('')
  const [channelLoading, setChannelLoading] = useState(true)
  const [insights, setInsights] = useState<ChannelInsights | null>(null)
  const [insightsError, setInsightsError] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [clips, setClips] = useState<KickClipCard[]>([])
  const [clipsError, setClipsError] = useState('')
  const [clipsLoading, setClipsLoading] = useState(true)
  const [clipVisible, setClipVisible] = useState(INITIAL_CLIPS)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const title = darkMode ? 'text-white' : 'text-gray-900'
  const panel = darkMode
    ? 'rounded-2xl border border-white/10 bg-sdhq-dark-800/60'
    : 'rounded-2xl border border-sdhq-cyan-100 bg-white/80'

  const loadChannel = useCallback(async () => {
    setChannelLoading(true)
    setChannelError('')
    try {
      const res = await fetch('/api/home/channel', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load channel')
      setChannel(data.channel as KickChannelSnapshot)
      setLeaderboard(
        data.leaderboard?.giftedSubs && data.leaderboard?.kicks
          ? (data.leaderboard as KickLeaderboard)
          : emptyKickLeaderboard()
      )
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'Could not load channel')
    } finally {
      setChannelLoading(false)
    }
  }, [])

  const loadInsights = useCallback(async (refresh = false) => {
    setInsightsLoading(true)
    setInsightsError('')
    try {
      const res = await fetch(`/api/home/insights${refresh ? '?refresh=1' : ''}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load insights')
      setInsights(data.insights as ChannelInsights)
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : 'Could not load insights')
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  const loadClips = useCallback(async () => {
    setClipsLoading(true)
    setClipsError('')
    try {
      const res = await fetch('/api/home/clips?page=1', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load clips')
      setClips(Array.isArray(data.clips) ? data.clips : [])
      setClipVisible(INITIAL_CLIPS)
    } catch (error) {
      setClipsError(error instanceof Error ? error.message : 'Could not load clips')
    } finally {
      setClipsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadChannel()
    void loadInsights()
    void loadClips()
  }, [loadChannel, loadInsights, loadClips])

  const visibleClips = useMemo(() => clips.slice(0, clipVisible), [clips, clipVisible])
  const lastLive = formatWhen(channel?.isLive ? channel.startedAt : channel?.lastLiveAt ?? null)

  useEffect(() => {
    setGiftedPeriod(defaultBoardPeriod(leaderboard.giftedSubs))
    setKicksPeriod(defaultBoardPeriod(leaderboard.kicks))
  }, [leaderboard])
  const socials = useMemo(() => {
    const rows = [...(channel?.socials || []), ...(insights?.socials || [])]
    const seen = new Set<string>()
    return rows.filter((social) => {
      const key = `${social.network}:${social.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [channel?.socials, insights?.socials])

  const analyzeClip = async (clip: KickClipCard) => {
    const sourceUrl = clip.videoUrl || clip.clipUrl
    setAnalyzingId(clip.id)
    setShowAnalysis(true)
    const result = await clipAnalyzer.analyzeFromSourceUrl({
      sourceUrl,
      platform: 'tiktok',
      fileName: `${clip.title || 'kick-clip'}.mp4`,
      loadingLabel: 'Analyzing for virality…',
    })
    setAnalyzingId(null)
    if (!result.ok) setShowAnalysis(true)
  }

  const analysis = clipAnalyzer.clipAnalysisResult
  const editTips = [
    analysis?.hookAnalysis?.improvement,
    ...(analysis?.recommendations || [])
      .slice()
      .sort((a, b) => {
        const rank = (p?: string) => (p === 'high' ? 0 : p === 'med' ? 1 : 2)
        return rank(a.priority) - rank(b.priority)
      })
      .map((rec) => rec.text),
  ]
    .filter((text): text is string => Boolean(text && text.trim()))
    .slice(0, 5)

  return (
    <div className={`${cardClasses} ${tabPanelClasses} space-y-5`}>
      <section
        className={`relative overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-8 sm:py-10 ${
          darkMode
            ? 'bg-gradient-to-br from-sdhq-dark-900 via-sdhq-dark-800 to-emerald-950/40'
            : 'bg-gradient-to-br from-cyan-50 via-white to-emerald-50'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_55%)]" />
        <div className="relative">
          <p className={`mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${muted}`}>
            <Home className="h-3.5 w-3.5 text-sdhq-cyan-400" />
            Creator home
          </p>
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
            <span className={title}>Educate. Create. </span>
            <span className="bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-green-400 bg-clip-text text-transparent">
              GROW!
            </span>
          </h2>
          <p className={`mx-auto mt-3 max-w-xl text-sm sm:text-base ${muted}`}>
            Welcome back, {user.display_name}. Your Kick snapshot, channel story, and recent clips live here.
          </p>
          {onOpenTab ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <QuickLink label="Educate" icon={<GraduationCap className="h-3.5 w-3.5" />} onClick={() => onOpenTab('educate')} />
              <QuickLink label="Create" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => onOpenTab('create')} />
              <QuickLink label="Analyze" icon={<BarChart3 className="h-3.5 w-3.5" />} onClick={() => onOpenTab('analyze')} />
            </div>
          ) : null}
        </div>
      </section>

      {channel && !channelLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip darkMode={darkMode} label="Followers" value={formatCount(channel.followersCount)} />
          <StatChip
            darkMode={darkMode}
            label={channel.isLive ? 'Live viewers' : 'Subscribers'}
            value={formatCount(channel.isLive ? channel.viewerCount : channel.subscriberCount)}
          />
          <StatChip darkMode={darkMode} label="Category" value={channel.category || '—'} />
          <StatChip
            darkMode={darkMode}
            label={channel.isLive ? 'Live since' : channel.lastLiveAt ? 'Last live' : 'Recent games'}
            value={
              channel.isLive || channel.lastLiveAt
                ? lastLive || '—'
                : channel.recentCategories.slice(0, 2).join(' · ') || '—'
            }
          />
        </div>
      ) : null}

      <section className={`${panel} overflow-hidden`}>
        {channelLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sdhq-cyan-400" />
          </div>
        ) : channelError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-400">{channelError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadChannel()}>
              Retry
            </Button>
          </div>
        ) : channel ? (
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {channel.isLive ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
                  <Radio className="h-4 w-4 animate-pulse" />
                  LIVE · {channel.streamTitle || 'Streaming now'}
                </div>
              ) : (
                <div className={`flex items-center gap-2 text-sm font-semibold ${muted}`}>
                  <Video className="h-4 w-4" />
                  Offline preview
                  {lastLive ? ` · last live ${lastLive}` : ''}
                </div>
              )}
              <div className={`flex items-center gap-3 text-xs ${muted}`}>
                {channel.category ? <span>{channel.category}</span> : null}
                {channel.isLive ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {formatCount(channel.viewerCount)}
                  </span>
                ) : null}
                <a
                  href={channel.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-sdhq-cyan-300 hover:underline"
                >
                  {channel.isLive ? 'Watch on Kick' : 'Open Kick channel'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div className="mx-auto w-[33%] min-w-[12rem] max-w-full overflow-hidden rounded-xl bg-black shadow-lg">
              <div className="aspect-video w-full">
                <iframe
                  title={`${channel.displayName} on Kick`}
                  src={
                    channel.isLive
                      ? `${channel.playerEmbedUrl}?autoplay=true&muted=true`
                      : channel.playerEmbedUrl
                  }
                  className="h-full w-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  scrolling="no"
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4">
          <h3 className={`flex items-center gap-2 text-xl font-bold ${title}`}>
            <Trophy className="h-5 w-5 text-sdhq-cyan-400" />
            Channel Leaderboards
          </h3>
          <p className={`mt-1 text-xs ${muted}`}>Gifted subs and KICKs, each with week / month / lifetime</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LeaderboardCard
            darkMode={darkMode}
            title="Gifted Subs"
            icon={<Gift className="h-4 w-4" />}
            unit="subs"
            board={leaderboard.giftedSubs}
            period={giftedPeriod}
            onPeriodChange={setGiftedPeriod}
          />
          <LeaderboardCard
            darkMode={darkMode}
            title="KICKs"
            icon={<Trophy className="h-4 w-4" />}
            unit="KICKs"
            board={leaderboard.kicks}
            period={kicksPeriod}
            onPeriodChange={setKicksPeriod}
          />
        </div>
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className={`text-xl font-bold ${title}`}>Your Channel Insights</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadInsights(true)}
            disabled={insightsLoading}
          >
            {insightsLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Refresh
          </Button>
        </div>
        {insightsLoading && !insights && socials.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-sdhq-cyan-400" />
          </div>
        ) : insightsError && !insights && socials.length === 0 ? (
          <p className="text-sm text-red-400">{insightsError}</p>
        ) : insights || socials.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights ? (
              <>
                <InsightCard darkMode={darkMode} label="Streamer Background" body={insights.streamerBackground} />
                <InsightCard darkMode={darkMode} label="Game Styles" body={insights.gameStyles} />
                <InsightCard
                  darkMode={darkMode}
                  label="Fav Games"
                  body={insights.favoriteGames.length ? insights.favoriteGames.join(' · ') : 'None listed yet'}
                />
                <InsightCard darkMode={darkMode} label="Schedule" body={insights.schedule} />
              </>
            ) : null}
            <div
              className={`sm:col-span-2 rounded-xl border p-4 ${
                darkMode ? 'border-white/10 bg-sdhq-dark-900/40' : 'border-sdhq-cyan-100 bg-cyan-50/40'
              }`}
            >
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>Socials</p>
              {socials.length === 0 ? (
                <p className={`text-sm ${muted}`}>No public social links found on the Kick profile.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {socials.map((social) => (
                    <li key={`${social.network}-${social.url}`}>
                      {social.url ? (
                        <a
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                            darkMode ? 'bg-white/10 text-sdhq-cyan-200' : 'bg-white text-sdhq-cyan-700 shadow-sm'
                          }`}
                        >
                          {social.network}
                          {social.username ? ` · ${social.username}` : ''}
                        </a>
                      ) : (
                        <span className={`text-sm ${title}`}>
                          {social.network}
                          {social.username ? ` · ${social.username}` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className={`mt-3 text-xs ${muted}`}>
                {insights?.sourceNotes || 'Pulled from Kick profile social fields and about links.'}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className={`text-xl font-bold ${title}`}>Recent Clips</h3>
          <p className={`text-xs ${muted}`}>Showing {visibleClips.length} of {Math.min(clips.length, PAGE_SIZE)}</p>
        </div>
        {clipsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-sdhq-cyan-400" />
          </div>
        ) : clipsError ? (
          <p className="text-sm text-red-400">{clipsError}</p>
        ) : clips.length === 0 ? (
          <p className={`text-sm ${muted}`}>
            Kick does not publish an official clips API yet, so this list uses public Kick pages. If it stays empty,
            this channel may not have public clips, or Kick blocked the lookup.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleClips.map((clip) => {
                const duration = formatDuration(clip.durationSeconds)
                return (
                  <article
                    key={clip.id}
                    className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10' : 'border-sdhq-cyan-100'}`}
                  >
                    <a href={clip.clipUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-black">
                      {clip.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">
                          <Video className="h-8 w-8" />
                        </div>
                      )}
                      {duration ? (
                        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {duration}
                        </span>
                      ) : null}
                    </a>
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className={`line-clamp-2 text-sm font-semibold ${title}`}>{clip.title}</p>
                        <p className={`mt-1 text-xs ${muted}`}>
                          {clip.views != null ? `${formatCount(clip.views)} views` : 'Clip'}
                          {clip.createdAt ? ` · ${new Date(clip.createdAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <Button
                        title={hasUnlimitedAccess ? 'Analyze for virality' : 'Analyze for virality · 2 coins'}
                        size="sm"
                        className="h-8 shrink-0 px-2 text-xs"
                        disabled={clipAnalyzer.isAnalyzingClip}
                        onClick={() => void analyzeClip(clip)}
                      >
                        {analyzingId === clip.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1">Analyze</span>
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="mt-4 flex gap-2">
              {clipVisible < Math.min(clips.length, PAGE_SIZE) ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setClipVisible(Math.min(PAGE_SIZE, clips.length))}
                >
                  Show more
                </Button>
              ) : null}
              {clipVisible > INITIAL_CLIPS ? (
                <Button variant="outline" className="flex-1" onClick={() => setClipVisible(INITIAL_CLIPS)}>
                  Show less
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>

      {showAnalysis ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-6"
          onClick={() => setShowAnalysis(false)}
        >
          <div
            className={`mb-8 w-full max-w-xl rounded-2xl border p-5 ${
              darkMode ? 'border-white/10 bg-sdhq-dark-900' : 'border-sdhq-cyan-100 bg-white'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className={`text-lg font-bold ${title}`}>Virality analysis</h3>
              <Button variant="outline" size="sm" onClick={() => setShowAnalysis(false)}>
                Close
              </Button>
            </div>
            {clipAnalyzer.isAnalyzingClip ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-sdhq-cyan-400" />
                <p className={`mt-3 text-sm ${muted}`}>{clipAnalyzer.loadingStep || 'Analyzing…'}</p>
              </div>
            ) : clipAnalyzer.clipError ? (
              <p className="text-sm text-red-400">{clipAnalyzer.clipError}</p>
            ) : analysis ? (
              <div className="space-y-3 text-sm">
                <p className={`text-2xl font-black ${title}`}>
                  Score {analysis.score}
                  {analysis.scoreTitle ? ` · ${analysis.scoreTitle}` : ''}
                </p>
                {analysis.scoreSummary ? <p className={muted}>{analysis.scoreSummary}</p> : null}
                {analysis.hookAnalysis?.summary ? (
                  <p className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                    Hook: {analysis.hookAnalysis.summary}
                  </p>
                ) : null}
                {editTips.length ? (
                  <div>
                    <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${muted}`}>
                      Edit for virality
                    </p>
                    <ul className="space-y-2">
                      {editTips.map((tip) => (
                        <li key={tip.slice(0, 48)} className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {onOpenTab ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowAnalysis(false)
                      onOpenTab('analyze')
                    }}
                  >
                    Open full Analyze tab
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className={`text-sm ${muted}`}>No analysis yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QuickLink({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-semibold text-sdhq-cyan-200 hover:bg-black/30"
    >
      {icon}
      {label}
    </button>
  )
}

function StatChip({
  darkMode,
  label,
  value,
}: {
  darkMode: boolean
  label: string
  value: string
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        darkMode ? 'border-white/10 bg-sdhq-dark-800/60' : 'border-sdhq-cyan-100 bg-white/80'
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className={`truncate text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function LeaderboardCard({
  darkMode,
  title,
  icon,
  unit,
  board,
  period,
  onPeriodChange,
}: {
  darkMode: boolean
  title: string
  icon: ReactNode
  unit: string
  board: KickLeaderboardPeriod
  period: 'week' | 'month' | 'lifetime'
  onPeriodChange: (next: 'week' | 'month' | 'lifetime') => void
}) {
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const heading = darkMode ? 'text-white' : 'text-gray-900'
  const rows = rowsForPeriod(board, period)
  return (
    <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-sdhq-dark-900/40' : 'border-sdhq-cyan-100 bg-cyan-50/30'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={`inline-flex items-center gap-1.5 text-sm font-bold ${heading}`}>
          {icon}
          {title}
        </p>
        <div className="flex gap-1">
          {(['week', 'month', 'lifetime'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPeriodChange(id)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                period === id
                  ? 'bg-sdhq-cyan-500 text-black'
                  : darkMode
                    ? 'bg-white/10 text-gray-300'
                    : 'bg-white text-sdhq-cyan-800'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      {!board.enabled && rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>No {title.toLowerCase()} leaderboard yet.</p>
      ) : rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>No entries in this period. Try another tab.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((entry) => (
            <li key={`${title}-${entry.userId || entry.username}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`w-5 text-center text-xs font-black ${entry.rank === 1 ? 'text-sdhq-cyan-400' : muted}`}>
                  {entry.rank}
                </span>
                <a
                  href={entry.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`truncate text-sm font-semibold hover:underline ${heading}`}
                >
                  {entry.username}
                </a>
              </div>
              <span className={`shrink-0 text-xs font-bold ${heading}`}>
                {formatCount(entry.quantity)} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function InsightCard({
  darkMode,
  label,
  body,
}: {
  darkMode: boolean
  label: string
  body: string
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        darkMode ? 'border-white/10 bg-sdhq-dark-900/40' : 'border-sdhq-cyan-100 bg-cyan-50/40'
      }`}
    >
      <p
        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
          darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-700'
        }`}
      >
        {label}
      </p>
      <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{body}</p>
    </div>
  )
}
