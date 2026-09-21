'use client'

import type { ClipAnalysisRecommendation } from '@/hooks/useClipAnalyzer'

type Overlay = {
  type: string
  timing: string
  description?: string
  details?: string[]
  proTips?: string[]
}

const OVERLAY_ICONS: Record<string, string> = {
  text: '✏️',
  sound: '🎵',
  visual: '🎬',
  cta: '👆',
}

function overlayGuide(type: string, timing: string): { details: string[]; proTips: string[] } {
  const guides: Record<string, { details: string[]; proTips: string[] }> = {
    text: {
      details: [
        'Open your video editor (CapCut, Premiere, or DaVinci Resolve)',
        'Add a new text layer and position in the safe zone (center 80% of screen)',
        'Choose bold, high-contrast font - white with black stroke works best',
        'Keep text concise: maximum 3-5 words per overlay',
        'Add subtle entrance animation (fade or slide, 0.3s duration)',
        'Display overlay for minimum 2-3 seconds so viewers can read',
        'Use platform-safe fonts that render correctly on mobile devices',
      ],
      proTips: [
        'Test text readability on a small phone screen before posting',
        'Use text to emphasize key quotes or data points',
        'Avoid text at very top/bottom where UI elements may cover it',
      ],
    },
    sound: {
      details: [
        'Import trending sound from platform library (TikTok: sound library, Instagram: music sticker, YouTube: audio library)',
        'Layer trending audio at 20-30% volume underneath your main voice audio',
        'Sync audio peaks and beats with visual transitions and cuts',
        'Add sound effects (whoosh, pop, ding) for emphasis on key moments',
        'If not using trending sound, ensure royalty-free music to avoid copyright strikes',
        'Test final audio levels on mobile device - should be clear without being too loud',
        'Export with audio normalized to -14 LUFS for platform compliance',
      ],
      proTips: [
        'TikTok algorithm heavily weights videos using trending sounds within first 48 hours',
        'Original audio + trending sound overlay = best of both worlds',
        'Always check sound volume on mobile before posting - many watch without headphones',
      ],
    },
    visual: {
      details: [
        'Identify the transition point in your video where this effect should begin',
        `Apply transition effect between scenes (cut, slide, zoom, or morph depending on content style)`,
        'Add zoom (110-120%) or pan effect for static moments to maintain visual interest',
        'Use color grading/lut to maintain consistent look throughout entire video',
        'Insert B-roll footage if main shot becomes visually stagnant',
        'Add motion graphics or animated elements for data points or statistics',
        'Keep effects subtle - fast cuts every 1-2 seconds maximum to avoid viewer fatigue',
        'Match transition speed to content energy (fast for high-energy, slow for calm moments)',
      ],
      proTips: [
        'Rule of thumb: cut every 2-3 seconds minimum in first 15 seconds',
        'Zoom effects work great when revealing something or emphasizing a point',
        'Always render preview at full quality before final export to catch visual issues',
      ],
    },
    cta: {
      details: [
        'Create text overlay with action words: "Follow", "Comment", "Share", "Save", "Link in bio"',
        'Position CTA in bottom third or top safe zone away from platform UI elements',
        'Use high-contrasting colors - white text with black stroke is most readable',
        'Keep CTA on screen for 3-5 seconds minimum so viewers can process and act',
        'Add subtle pulse, glow, or bounce animation to draw attention without being annoying',
        'Include arrow, finger pointing, or circle animation if space permits',
        'For "Link in bio" CTAs: ensure your bio actually has the link ready before posting',
        'Test CTA placement on mobile to confirm it is not covered by like/comment buttons',
      ],
      proTips: [
        'One clear CTA beats multiple confusing ones - pick the action you want most',
        '"Save this" or "Share with a friend" often outperform generic "Follow me" CTAs',
        'Pin a comment with the same CTA immediately after posting for reinforcement',
      ],
    },
  }
  return (
    guides[type] || {
      details: [
        `Review the suggested timing (${timing}) in your video`,
        'Apply the overlay using your preferred editor',
        'Preview on mobile device before final export',
        'Test on actual device screen size',
        'Adjust opacity if needed',
        'Export and review final quality',
        'Post and monitor performance metrics',
      ],
      proTips: [
        'Always test overlays on actual mobile device screen size',
        'Check that overlay does not cover important visual elements',
        'Render preview at full quality before final export',
      ],
    }
  )
}

function sortRecommendations(recs: ClipAnalysisRecommendation[]) {
  return [...recs].sort((a, b) => {
    const rank = (p?: string) => (p === 'high' ? 0 : p === 'med' ? 1 : 2)
    return rank(a.priority) - rank(b.priority)
  })
}

export default function ClipEditSuggestionsPanel({
  darkMode,
  overlays,
  recommendations,
}: {
  darkMode: boolean
  overlays?: Overlay[]
  recommendations?: ClipAnalysisRecommendation[]
}) {
  const heading = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  const body = darkMode ? 'text-gray-300' : 'text-gray-700'
  const panel = darkMode
    ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20'
    : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
  const recs = sortRecommendations(recommendations || [])
  const rows = overlays || []

  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden rounded-xl border p-4 ${panel}`}>
        <h4 className={`mb-3 text-base font-semibold uppercase tracking-wider ${heading}`}>
          Overlay & Edit Suggestions
        </h4>
        {rows.length === 0 ? (
          <p className={`text-sm ${body}`}>No overlay suggestions for this clip.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map((overlay, idx) => {
              const fallback = overlayGuide(overlay.type, overlay.timing)
              const content = {
                details: overlay.details?.length ? overlay.details : fallback.details,
                proTips: overlay.proTips?.length ? overlay.proTips : fallback.proTips,
              }
              return (
                <div
                  key={`${overlay.type}-${overlay.timing}-${idx}`}
                  className={`flex flex-col overflow-hidden rounded-xl border-2 ${
                    darkMode ? 'border-sdhq-cyan-500/20 bg-sdhq-dark-700/50' : 'border-sdhq-cyan-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col items-center p-4 text-center">
                    <span className="mb-2 text-3xl">{OVERLAY_ICONS[overlay.type] || '✨'}</span>
                    <div className={`mb-1 text-sm font-semibold uppercase ${heading}`}>{overlay.type}</div>
                    <div className={`font-mono text-sm ${heading}`}>{overlay.timing}</div>
                  </div>
                  <div className="px-4 pb-3">
                    <div className={`rounded p-3 ${darkMode ? 'bg-sdhq-dark-800' : 'bg-gray-50'}`}>
                      <div className={`mb-2 text-sm font-semibold ${heading}`}>🎬 Implementation Guide</div>
                      {overlay.description ? (
                        <p className={`mb-3 text-sm ${body}`}>{overlay.description.replace(/<[^>]*>/g, '')}</p>
                      ) : null}
                      <ol className={`space-y-2 text-sm ${body}`}>
                        {content.details.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-2">
                            <span className="mt-0.5 font-mono text-sdhq-cyan-500">{sIdx + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div
                      className={`rounded p-3 ${
                        darkMode
                          ? 'border border-sdhq-cyan-500/20 bg-sdhq-cyan-500/10'
                          : 'border border-sdhq-cyan-200 bg-sdhq-cyan-50'
                      }`}
                    >
                      <div className={`mb-2 text-sm font-semibold ${heading}`}>💡 Pro Tips</div>
                      <ul className={`space-y-2 text-sm ${body}`}>
                        {content.proTips.map((tip, tIdx) => (
                          <li key={tIdx} className="flex items-start gap-2">
                            <span className="mt-1 text-sdhq-cyan-500">→</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={`relative overflow-hidden rounded-xl border p-4 ${panel}`}>
        <h4 className={`mb-3 text-base font-semibold uppercase tracking-wider ${heading}`}>Suggested Edits</h4>
        {recs.length === 0 ? (
          <p className={`text-sm ${body}`}>No suggested edits for this clip.</p>
        ) : (
          <ul className="space-y-2">
            {recs.map((rec, i) => (
              <li key={`${rec.category}-${i}`} className={`flex gap-2 text-sm ${body}`}>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    rec.priority === 'high'
                      ? 'bg-red-500/20 text-red-300'
                      : rec.priority === 'med'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {rec.priority || 'tip'}
                </span>
                <span>
                  {rec.category ? <span className="font-medium">{rec.category}: </span> : null}
                  {rec.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
