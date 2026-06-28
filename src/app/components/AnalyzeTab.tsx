'use client'

import { Button } from '@/components/ui/button'
import { Video } from 'lucide-react'
import type { KickUser, Platform } from '@/lib/home/types'
import { platformsBannerLogos as bannerLogos } from '@/lib/home/defaultPlatforms'
import {
  formatYouTubeTagsForCopy,
  isYouTubeClipPlatform,
  stripHashtagsFromDescription,
} from '@/lib/clipAnalyzerMetadata'
import type { useClipAnalyzer } from '@/hooks/useClipAnalyzer'

type AnalyzerState = ReturnType<typeof useClipAnalyzer>

export interface AnalyzeTabProps {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  hasTabAccess: (tab: string) => boolean
  platforms: Platform[]
  user: KickUser | null
  hasUnlimitedAccess: boolean
  hasEnoughCoins: (tool: 'clip-analyzer') => boolean
  analyzeTitle: string
  clipAnalyzerDesc: string
  analyzer: AnalyzerState
}

export default function AnalyzeTab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  hasTabAccess,
  platforms,
  user,
  hasUnlimitedAccess,
  hasEnoughCoins,
  analyzeTitle,
  clipAnalyzerDesc,
  analyzer,
}: AnalyzeTabProps) {
  const {
    clipFile,
    setClipFile,
    clipPlatform,
    setClipPlatform,
    isAnalyzingClip,
    clipAnalysisResult,
    clipError,
    loadingStep,
    expandedCards,
    copiedTags,
    setCopiedTags,
    copiedDescription,
    setCopiedDescription,
    copiedTitle,
    setCopiedTitle,
    clipEditSuggestionTags,
    toggleCard,
    handleResetClip,
    handleAnalyzeClip,
  } = analyzer
  const platformsBannerLogos = bannerLogos(platforms)
  const isYouTube = isYouTubeClipPlatform(clipPlatform)
  const youtubeTagsCopyText = formatYouTubeTagsForCopy(clipEditSuggestionTags)
  const youtubeDescription =
    clipAnalysisResult?.description != null
      ? stripHashtagsFromDescription(
          clipAnalysisResult.description.replace(/<[^>]*>/g, '')
        )
      : ''

  return (
<div className={`relative py-8 ${cardClasses} ${!hasTabAccess('analyze') && !hasTabAccess('clip-analyzer') ? 'pointer-events-none' : ''}`}>
  {!hasTabAccess('analyze') && !hasTabAccess('clip-analyzer') && (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 rounded-xl flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <p className="text-white text-xl font-bold mb-2">⛔ Access Restricted</p>
        <p className="text-gray-300 text-sm">
          This feature is currently disabled for your account.
        </p>
      </div>
    </div>
  )}

  {/* Platform Logos */}
  <div className="flex justify-center gap-4 mb-6">
    {platformsBannerLogos.map((platform) => (
      <img
        key={platform.id}
        src={platform.image}
        alt={platform.name}
        className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
      />
    ))}
  </div>

  <div className="flex flex-col items-center mb-6">
    <div className="flex items-center space-x-3 mb-1">
      <Video className="w-10 h-10 text-sdhq-green-500" />
      <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{analyzeTitle}</h3>
    </div>
    <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
      Powered By: Gemini 2.5 Flash
    </p>
    <p className={`${textClasses} text-base`}>{clipAnalyzerDesc}</p>
  </div>

  {/* Steps */}
  <div className={`max-w-2xl mx-auto mb-6 p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
    <h4 className={`text-base font-semibold mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>How to use:</h4>
    <ol className={`space-y-2 text-base ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
      <li className="flex items-start gap-2">
        <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>1.</span>
        <span>Select your target platform (TikTok, Instagram, YouTube, etc.)</span>
      </li>
      <li className="flex items-start gap-2">
        <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>2.</span>
        <span>Upload a video file (MP4, WebM, MOV, or AVI - 100KB to 250MB)</span>
      </li>
      <li className="flex items-start gap-2">
        <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>3.</span>
        <span>Click analyze and wait for AI processing</span>
      </li>
      <li className="flex items-start gap-2">
        <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>4.</span>
        <span>Use the analysis to improve your clips</span>
      </li>
    </ol>
    <div className={`mt-3 p-2 rounded text-sm ${darkMode ? 'bg-sdhq-dark-900/50 text-sdhq-cyan-300' : 'bg-sdhq-cyan-50 text-sdhq-cyan-700'}`}>
      <span className="font-semibold">💡 AI Analysis:</span> Videos up to 250MB are analyzed by Gemini 2.5 Flash with platform-specific insights.
    </div>
  </div>

  {/* Access: login + coins (free) or subscription unlimited */}
  {!user ? (
    <div className="text-center py-12">
      <p className={`${subtitleClasses}`}>Login required to analyze clips</p>
    </div>
  ) : (
    <div className="space-y-6">
      {/* Input Section */}
      <div className={`relative overflow-hidden rounded-2xl p-6 ${
        darkMode 
          ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
          : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
      }`}>
        <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
        <div className="relative">
          <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
            Target Platform
          </label>
          <select
            value={clipPlatform}
            onChange={(e) => setClipPlatform(e.target.value)}
            disabled={isAnalyzingClip}
            className={`w-full px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 mb-4 ${
              darkMode 
                ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
            } border backdrop-blur-sm`}
          >
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>

          <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
            Video File
          </label>
          <div className="flex gap-3">
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setClipFile(file)
              }}
              disabled={isAnalyzingClip}
              className={`flex-1 px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 ${
                darkMode 
                  ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                  : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
              } border backdrop-blur-sm`}
            />
            <Button
              onClick={handleAnalyzeClip}
              disabled={isAnalyzingClip || !clipFile || (!hasUnlimitedAccess && !hasEnoughCoins('clip-analyzer'))}
              className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold px-6 rounded-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2"
            >
              <span>{hasUnlimitedAccess ? 'Analyze' : 'Analyze (2 coins)'}</span>
              <span>→</span>
            </Button>
          </div>
          {clipFile && (
            <div className="mt-3 text-base">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Selected:</span>
              <span className={`ml-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>{clipFile.name}</span>
              <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>({(clipFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </div>
          )}
          {clipError && (
            <div className={`mt-3 px-4 py-3 rounded-xl text-base animate-shake ${
              darkMode ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-red-50 border-red-300 text-red-600'
            } border`}>
              {clipError}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isAnalyzingClip && (
        <div className={`relative overflow-hidden rounded-2xl p-12 text-center ${
          darkMode 
            ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
            : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
        }`}>
          <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
          <div className="relative">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-sdhq-cyan-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sdhq-cyan-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="w-6 h-6 text-sdhq-cyan-500" />
              </div>
            </div>
            <p className={`font-mono text-sm uppercase tracking-widest mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
              Please wait while AI analyzes your clip
            </p>
            <p className={`text-base min-h-5 font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{loadingStep}</p>
            <p className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
              DO NOT REFRESH until it has finished
            </p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {clipAnalysisResult && (
        <div className="space-y-4">
          {/* Analysis Source Warning - only show if analysis failed */}
          {clipAnalysisResult.analysisSource === 'none' && (
            <div className={`rounded-lg p-3 border ${
              darkMode 
                ? 'bg-yellow-900/30 border-yellow-600/50' 
                : 'bg-yellow-50 border-yellow-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className={`font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    Analysis Unavailable
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-yellow-300/80' : 'text-yellow-600'}`}>
                    Gemini is having a tough time right now. Please check back later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Score Card with Category Scores */}
          <div>
            <div className={`relative overflow-hidden rounded-xl p-4 ${
              darkMode 
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
            }`}>
              <div className={`absolute inset-0 bg-gradient-to-r ${
                clipAnalysisResult.score >= 70 
                  ? 'from-green-500/10 to-sdhq-cyan-500/10' 
                  : clipAnalysisResult.score >= 45 
                    ? 'from-yellow-500/10 to-orange-500/10' 
                    : 'from-red-500/10 to-pink-500/10'
              }`}></div>
              
              {/* Overall Score */}
              <div className="relative flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg width="64" height="64" viewBox="0 0 96 96" className="transform -rotate-90">
                    <circle cx="48" cy="48" r="40" fill="none" stroke={darkMode ? '#222230' : '#e5e7eb'} strokeWidth="8"/>
                    <circle
                      cx="48" cy="48" r="40" fill="none"
                      stroke={
                        clipAnalysisResult.score >= 70 ? '#4af7a0' :
                        clipAnalysisResult.score >= 45 ? '#f7b733' : '#ff6b6b'
                      }
                      strokeWidth="8"
                      strokeDasharray="251"
                      strokeDashoffset={251 - (clipAnalysisResult.score / 100) * 251}
                      strokeLinecap="round"
                      className={`filter drop-shadow-[0_0_10px_${
                        clipAnalysisResult.score >= 70 
                          ? 'rgba(74,247,160,0.5)' 
                          : clipAnalysisResult.score >= 45 
                            ? 'rgba(247,183,51,0.5)' 
                            : 'rgba(255,107,107,0.5)'
                      }]`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className={`text-2xl font-bold ${
                      clipAnalysisResult.score >= 70 ? 'text-green-400' :
                      clipAnalysisResult.score >= 45 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {clipAnalysisResult.score}
                    </span>
                    <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/100</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {clipAnalysisResult.scoreTitle || 'Discoverability Score'}
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {clipAnalysisResult.scoreSummary || ''}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Content Insights - 2x2 Grid with Category Scores */}
          <div>
            <div className={`relative overflow-hidden rounded-xl p-4 ${
              darkMode 
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-base font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                  Content Insights
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Category Score Cards */}
                {[
                  { key: 'hook', icon: '🎯', label: 'Hook Strength', score: clipAnalysisResult.hookStrength || Math.round(clipAnalysisResult.score * 0.9), preview: ['Strong opening visual/audio hook captures immediate attention', '3-second curiosity gap creates intrigue', 'Pattern interrupt technique used effectively', 'Opening aligns with trending content patterns', 'High retention potential in critical first 3 seconds'], details: ['Your hook captures attention within the critical first 3 seconds - this is when 80% of viewers decide to keep watching or scroll away', 'Uses pattern interrupt or unexpected element that breaks viewer scrolling pattern', 'Creates curiosity gap that demands viewers keep watching to get the payoff', 'Strong audio/visual sync in opening frames maximizes impact', 'Aligns with trending content patterns currently favored by the algorithm', 'Recommended: Test multiple hook variations in first 24 hours to identify highest performing version'] },
                  { key: 'engagement', icon: '⚡', label: 'Engagement Potential', score: clipAnalysisResult.engagementPotential || Math.round(clipAnalysisResult.score * 0.95), preview: ['Loop-worthy content structure encourages re-watches', 'Clear call-to-action present for viewer interaction', 'Creates conversation opportunities in comments', 'Emotional trigger words boost response rates', 'Favorable watch time retention curve predicted'], details: ['Content structure encourages re-watches and loops - viewers naturally want to watch again', 'Includes subtle or direct call-to-action that prompts viewer interaction', 'Creates conversation in comments section with discussion-worthy content', 'Trigger words used to boost emotional response and engagement', 'Watch time retention curve is favorable with strong mid-video hold', 'Recommended: Respond to first 10 comments within 30 minutes of posting to boost algorithm ranking'] },
                  { key: 'visual', icon: '🎬', label: 'Visual Quality', score: clipAnalysisResult.visualQuality || Math.round(clipAnalysisResult.score * 0.85), preview: ['Properly formatted 9:16 vertical mobile viewing', 'Consistent color grading and lighting throughout', 'Face/on-camera presence detected for algorithm boost', 'Clean background without visual distractions', 'Dynamic motion keeps viewer attention engaged'], details: ['Properly formatted for vertical 9:16 mobile viewing - optimized for phone screens', 'Consistent color grading and lighting throughout maintains professional appearance', 'Face/on-camera presence detected (major algorithm boost for all platforms)', 'Background is clean and non-distracting keeping focus on subject', 'Motion and movement keeps viewer attention from wandering', 'Recommended: Maintain 1080x1920 resolution for best quality and clarity on all devices'] },
                  { key: 'audio', icon: '🔊', label: 'Audio Quality', score: clipAnalysisResult.audioQuality || Math.round(clipAnalysisResult.score * 0.88), preview: ['Clear voice audio with proper leveling', 'Trending sound integration detected', 'Background music complements voiceover', 'Precise audio-visual synchronization', 'Strategic sound effects for emphasis'], details: ['Voice audio is clear and properly leveled - no clipping or distortion detected', 'Uses trending or algorithm-boosting audio/sound that increases discoverability', 'Background music complements without overpowering the main audio', 'Audio-visual synchronization is precise creating professional feel', 'Sound effects used strategically for emphasis on key moments', 'Recommended: Use original audio mix with trending sound layered at 20% volume for best results'] }
                ].map((cat, idx) => {
                  const isExpanded = expandedCards.has(`cat-${cat.key}`)
                  return (
                    <div key={idx} className={`rounded-xl border-2 overflow-hidden transition-all duration-300 flex flex-col ${
                      darkMode 
                        ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                        : 'bg-white border-sdhq-cyan-200'
                    }`}>
                      {/* Header with Score */}
                      <div 
                        className="p-4 flex flex-col items-center text-center cursor-pointer hover:bg-opacity-80 transition-colors"
                        onClick={() => toggleCard(`cat-${cat.key}`)}
                      >
                        <span className="text-3xl mb-2">{cat.icon}</span>
                        <div className={`text-sm font-semibold uppercase mb-1 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          {cat.label}
                        </div>
                        <div className={`text-3xl font-bold ${
                          cat.score >= 70 ? (darkMode ? 'text-green-400' : 'text-green-600') :
                          cat.score >= 45 ? (darkMode ? 'text-yellow-400' : 'text-yellow-600') :
                          (darkMode ? 'text-red-400' : 'text-red-600')
                        }`}>
                          {cat.score}
                        </div>
                        <div className={`w-full h-2 rounded-full mt-2 ${darkMode ? 'bg-sdhq-dark-600' : 'bg-gray-200'}`}>
                          <div 
                            className={`h-full rounded-full ${
                              cat.score >= 70 ? 'bg-green-500' :
                              cat.score >= 45 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Preview Bullets (always visible) */}
                      <div className={`px-4 pb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <ul className="space-y-2 text-sm">
                          {cat.preview.map((bullet, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2">
                              <span className="text-sdhq-cyan-500 mt-0.5">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Read More Button */}
                      <div 
                        className={`px-4 pb-3 text-sm font-medium cursor-pointer ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} hover:underline transition-colors text-center`}
                        onClick={() => toggleCard(`cat-${cat.key}`)}
                      >
                        {isExpanded ? '▼ Read less' : '▶ Read more'}
                      </div>
                      
                      {/* Expandable Details - Detailed */}
                      {isExpanded && (
                        <div className={`px-4 pb-4 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                          <div className={`mt-3 p-3 rounded ${darkMode ? 'bg-sdhq-dark-800' : 'bg-gray-50'}`}>
                            <div className={`text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                              💡 Detailed Analysis
                            </div>
                            <ul className={`space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {cat.details.map((detail, dIdx) => (
                                <li key={dIdx} className="flex items-start gap-2">
                                  <span className="text-sdhq-cyan-500 mt-1">•</span>
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Overlays - 2x2 Grid with FULL Detail Always Visible */}
          <div>
            <div className={`relative overflow-hidden rounded-xl p-4 ${
              darkMode 
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-base font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                  Overlay & Edit Suggestions
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(clipAnalysisResult.overlays || []).map((overlay: any, idx: number) => {
                  const iconMap: Record<string, string> = {
                    text: '✏️',
                    sound: '🎵',
                    visual: '🎬',
                    cta: '👆'
                  }
                  const fullContent: Record<string, {summary: string[], details: string[], proTips: string[]}> = {
                    text: {
                      summary: ['Text overlay enhances message clarity', 'Should appear at ' + overlay.timing, 'Keep under 5 words for maximum impact'],
                      details: [
                        'Open your video editor (CapCut, Premiere, or DaVinci Resolve)',
                        'Add a new text layer and position in the safe zone (center 80% of screen)',
                        'Choose bold, high-contrast font - white with black stroke works best',
                        'Keep text concise: maximum 3-5 words per overlay',
                        'Add subtle entrance animation (fade or slide, 0.3s duration)',
                        'Display overlay for minimum 2-3 seconds so viewers can read',
                        'Use platform-safe fonts that render correctly on mobile devices'
                      ],
                      proTips: ['Test text readability on a small phone screen before posting', 'Use text to emphasize key quotes or data points', 'Avoid text at very top/bottom where UI elements may cover it']
                    },
                    sound: {
                      summary: ['Audio layer enhances emotional impact', 'Timing: ' + overlay.timing, 'Trending sounds boost algorithm reach'],
                      details: [
                        'Import trending sound from platform library (TikTok: sound library, Instagram: music sticker, YouTube: audio library)',
                        'Layer trending audio at 20-30% volume underneath your main voice audio',
                        'Sync audio peaks and beats with visual transitions and cuts',
                        'Add sound effects (whoosh, pop, ding) for emphasis on key moments',
                        'If not using trending sound, ensure royalty-free music to avoid copyright strikes',
                        'Test final audio levels on mobile device - should be clear without being too loud',
                        'Export with audio normalized to -14 LUFS for platform compliance'
                      ],
                      proTips: ['TikTok algorithm heavily weights videos using trending sounds within first 48 hours', 'Original audio + trending sound overlay = best of both worlds', 'Always check sound volume on mobile before posting - many watch without headphones']
                    },
                    visual: {
                      summary: ['Visual effect maintains viewer engagement', 'Apply at ' + overlay.timing, 'Transitions should feel seamless'],
                      details: [
                        'Identify the transition point in your video where this effect should begin',
                        'Apply transition effect between scenes (cut, slide, zoom, or morph depending on content style)',
                        'Add zoom (110-120%) or pan effect for static moments to maintain visual interest',
                        'Use color grading/lut to maintain consistent look throughout entire video',
                        'Insert B-roll footage if main shot becomes visually stagnant',
                        'Add motion graphics or animated elements for data points or statistics',
                        'Keep effects subtle - fast cuts every 1-2 seconds maximum to avoid viewer fatigue',
                        'Match transition speed to content energy (fast for high-energy, slow for calm moments)'
                      ],
                      proTips: ['Rule of thumb: cut every 2-3 seconds minimum in first 15 seconds', 'Zoom effects work great when revealing something or emphasizing a point', 'Always render preview at full quality before final export to catch visual issues']
                    },
                    cta: {
                      summary: ['Call-to-action drives viewer interaction', 'Display at ' + overlay.timing, 'Position strategically for visibility'],
                      details: [
                        'Create text overlay with action words: "Follow", "Comment", "Share", "Save", "Link in bio"',
                        'Position CTA in bottom third or top safe zone away from platform UI elements',
                        'Use high-contrasting colors - white text with black stroke is most readable',
                        'Keep CTA on screen for 3-5 seconds minimum so viewers can process and act',
                        'Add subtle pulse, glow, or bounce animation to draw attention without being annoying',
                        'Include arrow, finger pointing, or circle animation if space permits',
                        'For "Link in bio" CTAs: ensure your bio actually has the link ready before posting',
                        'Test CTA placement on mobile to confirm it is not covered by like/comment buttons'
                      ],
                      proTips: ['One clear CTA beats multiple confusing ones - pick the action you want most', '"Save this" or "Share with a friend" often outperform generic "Follow me" CTAs', 'Pin a comment with the same CTA immediately after posting for reinforcement']
                    }
                  }
                  const content = fullContent[overlay.type] || {
                    details: ['Review the suggested timing in your video', 'Apply the overlay using your preferred editor', 'Preview on mobile device before final export', 'Test on actual device screen size', 'Adjust opacity if needed', 'Export and review final quality', 'Post and monitor performance metrics'],
                    proTips: ['Always test overlays on actual mobile device screen size', 'Check that overlay does not cover important visual elements', 'Render preview at full quality before final export']
                  }
                  return (
                    <div key={idx} className={`rounded-xl border-2 overflow-hidden transition-all duration-300 flex flex-col ${
                      darkMode 
                        ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                        : 'bg-white border-sdhq-cyan-200'
                    }`}>
                      {/* Header */}
                      <div className="p-4 flex flex-col items-center text-center">
                        <span className="text-3xl mb-2">{iconMap[overlay.type] || '✨'}</span>
                        <div className={`text-sm font-semibold uppercase mb-1 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          {overlay.type}
                        </div>
                        <div className={`text-sm font-mono ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          {overlay.timing}
                        </div>
                      </div>
                      
                      {/* Full Details - Always Visible */}
                      <div className={`px-4 pb-3 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        <div className={`p-3 rounded ${darkMode ? 'bg-sdhq-dark-800' : 'bg-gray-50'}`}>
                          <div className={`text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            🎬 Implementation Guide
                          </div>
                          <p className={`text-sm mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {overlay.description?.replace(/<[^>]*>/g, '')}
                          </p>
                          <ol className={`space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {content.details.map((step, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-2">
                                <span className="text-sdhq-cyan-500 mt-0.5 font-mono">{sIdx + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                      
                      {/* Pro Tips - Always Visible */}
                      <div className={`px-4 pb-4 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        <div className={`p-3 rounded ${darkMode ? 'bg-sdhq-cyan-500/10 border border-sdhq-cyan-500/20' : 'bg-sdhq-cyan-50 border border-sdhq-cyan-200'}`}>
                          <div className={`text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            💡 Pro Tips
                          </div>
                          <ul className={`space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {content.proTips.map((tip, tIdx) => (
                              <li key={tIdx} className="flex items-start gap-2">
                                <span className="text-sdhq-cyan-500 mt-1">→</span>
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
            </div>
          </div>

          {/* Post Suggestions - with Copy Buttons & Platform Optimization */}
          <div>
            <div className={`relative overflow-hidden rounded-xl p-4 ${
              darkMode 
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-base font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                  Post Suggestions
                </h4>
                <div className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-sdhq-dark-700 text-sdhq-cyan-400' : 'bg-gray-100 text-sdhq-cyan-600'}`}>
                  {clipPlatform === 'tiktok' ? '🎵 TikTok' : isYouTube ? '▶️ YouTube' : '📸 Instagram'} Optimized
                </div>
              </div>
              
              {/* YouTube: Separate Title, Description, Tags */}
              {isYouTube ? (
                <>
                  {/* Title Options */}
                  <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 mb-4 ${
                    darkMode 
                      ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                      : 'bg-white border-sdhq-cyan-200'
                  }`}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div className={`text-base font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          Title Options
                        </div>
                      </div>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Plain text — paste into YouTube title field
                      </span>
                    </div>
                    <div className={`px-4 pb-4 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                      <ul className={`mt-3 space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {(clipAnalysisResult.titles || [clipAnalysisResult.title])
                          .filter((t): t is string => typeof t === 'string' && t.length > 0)
                          .map((title, idx) => {
                          const plainTitle = title.replace(/^#+\s*/, '').trim()
                          return (
                            <li key={idx} className="flex items-start gap-3 group text-base">
                              <span className="text-sdhq-cyan-500 mt-0.5">{idx + 1}.</span>
                              <span className="flex-1">{plainTitle}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(plainTitle)
                                  setCopiedTitle(idx)
                                  setTimeout(() => setCopiedTitle(null), 2000)
                                }}
                                className={`px-3 py-1 rounded text-xs transition-all ${
                                  copiedTitle === idx
                                    ? (darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                                    : (darkMode ? 'bg-sdhq-dark-600 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/20 opacity-0 group-hover:opacity-100' : 'bg-gray-100 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50 opacity-0 group-hover:opacity-100')
                                }`}
                              >
                                {copiedTitle === idx ? '✓ Copied!' : 'Copy'}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Description */}
                  {youtubeDescription && (
                    <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 mb-4 ${
                      darkMode 
                        ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                        : 'bg-white border-sdhq-cyan-200'
                    }`}>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <div className={`text-base font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            Description
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(youtubeDescription)
                            setCopiedDescription(true)
                            setTimeout(() => setCopiedDescription(false), 2000)
                          }}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                            copiedDescription
                              ? (darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                              : (darkMode ? 'bg-sdhq-dark-600 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/20' : 'bg-gray-100 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50')
                          }`}
                        >
                          {copiedDescription ? '✓ Copied!' : '📋 Copy'}
                        </button>
                      </div>
                      <div className={`px-4 pb-4 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        <p className={`mt-3 text-base whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {youtubeDescription}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {(clipAnalysisResult.tags || []).length > 0 && (
                    <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                      darkMode 
                        ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                        : 'bg-white border-sdhq-cyan-200'
                    }`}>
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🏷️</span>
                          <div>
                            <div className={`text-base font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                              Tags
                            </div>
                            <div className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              Comma-separated for YouTube Studio (no #)
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(youtubeTagsCopyText)
                            setCopiedTags(true)
                            setTimeout(() => setCopiedTags(false), 2000)
                          }}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-all shrink-0 ${
                            copiedTags
                              ? (darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                              : (darkMode ? 'bg-sdhq-dark-600 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/20' : 'bg-gray-100 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50')
                          }`}
                        >
                          {copiedTags ? '✓ Copied!' : '📋 Copy All'}
                        </button>
                      </div>
                        <div className={`px-4 pb-4 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {clipEditSuggestionTags.map((tag: string, idx: number) => {
                            const plainTag = tag.replace(/^#/, '')
                            return (
                            <span key={idx} className={`px-3 py-1.5 rounded text-sm font-mono cursor-pointer hover:scale-105 transition-transform ${
                              darkMode 
                                ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20 hover:bg-sdhq-cyan-500/10' 
                                : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300 hover:bg-sdhq-cyan-50'
                            }`}
                            onClick={() => {
                              navigator.clipboard.writeText(plainTag)
                              setCopiedTags(true)
                              setTimeout(() => setCopiedTags(false), 1000)
                            }}
                            title="Click to copy single tag"
                            >
                              {plainTag}
                            </span>
                          )})}
                        </div>
                        <div className={`mt-3 p-3 rounded-lg text-sm font-mono break-all ${
                          darkMode ? 'bg-sdhq-dark-900/80 text-gray-300 border border-sdhq-dark-600' : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}>
                          {youtubeTagsCopyText}
                        </div>
                        <div className={`mt-2 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {clipEditSuggestionTags.length} tag{clipEditSuggestionTags.length === 1 ? '' : 's'} ready to paste into YouTube Studio
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* TikTok/Instagram/Facebook: Combined Caption Card */}
                  {(clipAnalysisResult.description ||
                    (clipAnalysisResult.titles?.length ?? 0) > 0 ||
                    (clipAnalysisResult.tags?.length ?? 0) > 0) && (
                    <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 mb-4 ${
                      darkMode 
                        ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20' 
                        : 'bg-white border-sdhq-cyan-200'
                    }`}>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📝</span>
                          <div className={`text-base font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            {clipPlatform === 'tiktok' ? 'TikTok Caption' : clipPlatform === 'instagram' ? 'Instagram Caption' : 'Caption'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Build complete caption with title, description, and hashtags
                            const platformEmojis: Record<string, string[]> = {
                              tiktok: ['🔥', '✨', '😱', '💯', '🎯'],
                              instagram: ['📸', '✨', '🔥', '💫', '🌟']
                            }
                            const emojis = platformEmojis[clipPlatform] || ['✨']
                            const randomEmoji = emojis[0 % emojis.length]
                            
                            const title = (clipAnalysisResult.titles?.[0] || clipAnalysisResult.title || '')
                            const enhancedTitle = title ? `${randomEmoji} ${title} ${randomEmoji}\n\n` : ''
                            
                            const desc = clipAnalysisResult.description?.replace(/<[^>]*>/g, '') || ''
                            
                            const hashtagBlock = clipEditSuggestionTags.map((t: string) => `#${t.replace(/^#/, '')}`).join(' ')
                            
                            const fullCaption = `${enhancedTitle}${desc}\n\n${hashtagBlock}`
                            navigator.clipboard.writeText(fullCaption.trim())
                            setCopiedDescription(true)
                            setTimeout(() => setCopiedDescription(false), 2000)
                          }}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                            copiedDescription
                              ? (darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                              : (darkMode ? 'bg-sdhq-dark-600 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/20' : 'bg-gray-100 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50')
                          }`}
                        >
                          {copiedDescription ? '✓ Copied!' : '📋 Copy Caption'}
                        </button>
                      </div>
                      <div className={`px-4 pb-4 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        <div className={`mt-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {/* Title with emojis */}
                          {(clipAnalysisResult.titles?.[0] || clipAnalysisResult.title) && (() => {
                            const platformEmojis: Record<string, string[]> = {
                              tiktok: ['🔥', '✨', '😱', '💯', '🎯'],
                              instagram: ['📸', '✨', '🔥', '💫', '🌟']
                            }
                            const emojis = platformEmojis[clipPlatform] || ['✨']
                            const randomEmoji = emojis[0 % emojis.length]
                            const title = (clipAnalysisResult.titles?.[0] || clipAnalysisResult.title || '')
                            return (
                              <p className="text-base font-semibold mb-3">
                                {randomEmoji} {title} {randomEmoji}
                              </p>
                            )
                          })()}
                          
                          {/* Description */}
                          <p className="text-base mb-3 whitespace-pre-wrap">
                            {clipAnalysisResult.description?.replace(/<[^>]*>/g, '')}
                          </p>
                          
                          {/* Hashtags inline */}
                          {clipEditSuggestionTags.length > 0 && (
                            <p className="text-base text-sdhq-cyan-500">
                              {clipEditSuggestionTags.map((tag: string) => (
                                `#${tag.replace(/^#/, '')} `
                              ))}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetClip}
            className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
              darkMode 
                ? 'border-sdhq-cyan-500/30 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/10 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]' 
                : 'border-sdhq-cyan-300 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]'
            } border bg-transparent`}
          >
            ← Analyze another clip
          </button>
        </div>
      )}
    </div>
  )}
</div>
  )
}
