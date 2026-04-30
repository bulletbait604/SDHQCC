import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

// FIXED: Using gemini-2.0-flash model (stable release)

// In-memory rate limit storage for clip analyzer
const clipAnalyzerRateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxUses: number): { allowed: boolean; remaining: number; resetTime: number | null } {
  const now = Date.now()
  const record = clipAnalyzerRateLimitStore.get(identifier)

  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + 24 * 60 * 60 * 1000 }
    clipAnalyzerRateLimitStore.set(identifier, newRecord)
    return { allowed: true, remaining: maxUses - 1, resetTime: newRecord.resetTime }
  }

  if (record.count >= maxUses) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count += 1
  clipAnalyzerRateLimitStore.set(identifier, record)
  return { allowed: true, remaining: maxUses - record.count, resetTime: record.resetTime }
}

export async function POST(request: Request) {
  console.log('[DEBUG] Clip Analyze API: Request received')
  
  try {
    console.log('[DEBUG] Clip Analyze API: Parsing request body...')
    const body = await request.json()
    const { fileUri, mimeType, fileName, fileSize, platform, userId, userType } = body

    console.log('[DEBUG] Clip Analyze API: Request data:', { 
      hasFileUri: !!fileUri, 
      mimeType, 
      fileName,
      fileSizeMB: fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : 'unknown',
      platform, 
      userId, 
      userType,
      timestamp: new Date().toISOString()
    })

    // Validate required fields
    if (!fileUri) {
      console.error('[DEBUG] Clip Analyze API: fileUri is required')
      return NextResponse.json({ error: 'fileUri is required' }, { status: 400 })
    }
    
    if (!platform) {
      console.error('[DEBUG] Clip Analyze API: platform is required')
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }

    // Validate file size (min 100KB, max 250MB as requested)
    const minSize = 100 * 1024 // 100KB minimum
    const maxSize = 250 * 1024 * 1024 // 250MB maximum
    
    if (fileSize != null && fileSize > 0 && fileSize < minSize) {
      return NextResponse.json({ error: 'File size is too small. Video must be at least 100KB to analyze properly.' }, { status: 400 })
    }
    if (fileSize != null && fileSize > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 250MB. Please use a smaller video file.' }, { status: 400 })
    }

    // Rate limiting
    const identifier = userId || 'anonymous'
    let maxUses = 5 // Default for subscribers

    if (userType === 'owner' || userType === 'admin' || userType === 'lifetime') {
      maxUses = 999999 // Unlimited
    } else if (userType === 'subscribed') {
      maxUses = 5
    } else {
      console.error('[DEBUG] Clip Analyze API: Access denied - subscription required')
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    console.log('[DEBUG] Clip Analyze API: Rate limiting:', { identifier, maxUses, userType })
    
    const rateLimit = checkRateLimit(`clip-analyzer-${identifier}`, maxUses)
    
    console.log('[DEBUG] Clip Analyze API: Rate limit result:', { allowed: rateLimit.allowed, remaining: rateLimit.remaining })
    
    if (!rateLimit.allowed) {
      console.log('[ACTIVITY_LOG] Clip Analyze: Rate limit exceeded for', identifier)
      return NextResponse.json(
        { error: 'Rate limit exceeded. You have used your daily limit.', resetTime: rateLimit.resetTime },
        { status: 429 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API
    
    if (!geminiApiKey) {
      console.log('[ACTIVITY_LOG] Clip Analyze: GEMINI_API key not configured')
      return NextResponse.json({ 
        error: 'API not configured',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'GEMINI_API key not configured'
      }, { status: 503 })
    }

    // Create basic extracted data from file metadata
    const extractedData = {
      fileName: fileName || 'Unknown',
      fileSize: fileSize || 0,
      fileType: mimeType || 'video/mp4',
      duration: 'Unknown (requires video processing)',
      summary: `Uploaded video file: ${fileName || 'Unknown'} (${fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : 'Unknown'} MB)`,
      visualAnalysis: 'Video file uploaded for analysis',
      audioAnalysis: 'Video file uploaded for analysis',
      topics: [],
      keyPoints: [],
      source: 'direct-upload-gemini-oauth'
    }

    console.log('[DEBUG] Clip Analyze API: Starting Gemini analysis with file URI...')

    // Use AI to analyze the video file using the provided file URI
    let analysisResult = null
    let analysisSource = 'none'
    
    // Use stable gemini-2.0-flash model
    const MODEL_NAME = 'gemini-2.0-flash'

    try {
      // Initialize Google GenAI client
      const genAI = new GoogleGenAI({ apiKey: geminiApiKey })
      
      console.log('[DEBUG] Using model:', MODEL_NAME)
      
      // Analyze video using the file URI (already uploaded by frontend)
      const geminiResponse = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: mimeType || 'video/mp4',
                  fileUri: fileUri
                }
              },
              {
                text: `You are an expert social media algorithm analyst and content strategist. Analyze this video file IN-DEPTH for ${platform} optimization.

CRITICAL ANALYSIS REQUIREMENTS:
1. **SUBJECT MATTER IDENTIFICATION**: 
   - What is the video about? Identify main topic, theme, niche, and target audience
   - Detect if this is gaming content - identify the specific game being played
   - Detect if this is from a streaming platform (Twitch, YouTube Live, Kick, etc.) - identify the original streaming platform
   - Identify the content type (gameplay, commentary, tutorial, highlight, montage, vlog, etc.)
2. **VISUAL ANALYSIS**: 
   - Scene-by-scene breakdown (first 3 seconds, middle, ending)
   - Camera angles, lighting, color grading
   - Visual effects, transitions, text overlays
   - Motion, energy, pacing throughout
   - Thumbnail-worthy moments
   - Game-specific visual elements (UI, HUD, gameplay mechanics)
3. **AUDIO ANALYSIS**:
   - Speech/dialogue content (what is being said)
   - Background music genre, mood, energy level
   - Sound effects and their purpose
   - Audio quality (clarity, mixing, volume levels)
   - Voice tone and delivery style
   - Game audio (sound effects, music, voice lines)
4. **HOOK ANALYSIS**:
   - What grabs attention in first 1-3 seconds?
   - Is the hook visual, audio, or conceptual?
   - How effective is it for ${platform}?
5. **ENGAGEMENT MECHANICS**:
   - What keeps viewers watching?
   - Call-to-action opportunities
   - Shareable moments
   - Comment-worthy elements
6. **PLATFORM-SPECIFIC ALGORITHM PRIORITIES (2026):
- TikTok: Hook in first 1-2 seconds, completion rate, shares, saves, comments, trending audio, caption keywords, niche authority
- Instagram Reels: First 3 seconds engagement, watch time, saves, shares, carousel swipe-through, music trending, hashtags, Reels tab exploration
- YouTube Shorts: First 1 second hook, watch time, click-through rate, retention, comments, likes, shares, title optimization, posting schedule
- YouTube Long: First 5 seconds hook, retention, click-through rate, comments, likes, shares, title optimization, posting schedule, description keywords
- Twitch Clips: Highlight moments, community engagement, game/category relevance, editing pace, audio clarity, discoverability through recommendations
- Kick Clips: Early engagement, community interaction, category relevance, trending topics, audio quality, visual appeal, shareability
7. **SCORING CRITERIA (0-100):
- Hook strength (first 1-3 seconds): 25 points
- Content engagement potential: 20 points
- Visual/audio quality: 15 points
- Platform-specific optimization: 20 points
- Metadata quality (title/description/tags): 20 points
8. **TAG REQUIREMENTS (15-20 tags total):
Include a comprehensive mix of:
1. Platform-specific trending tags (e.g., #fyp, #foryou, #reels, #shorts)
2. Content-specific tags (what the video is actually about)
3. Game tags (if gaming content - include the game name and related tags)
4. Context tags (niche, theme, style, format)
5. Streaming platform tags (if from a stream - e.g., #twitchclip, #youtubelive)
6. Broad category tags for discoverability
7. Niche-specific tags for targeted audience

Return this exact JSON structure:
{
  "score": <integer 0-100>,
  "scoreTitle": "<short title: Excellent/Good/Fair/Needs Improvement>",
  "scoreSummary": "<2 sentences: main strength + 1 key improvement needed>",
  "insights": [
    { "icon": "<emoji>", "label": "Hook Strength", "value": "<rating: Strong/Moderate/Weak>", "description": "<why this rating + specific improvement - NO abbreviations>" },
    { "icon": "<emoji>", "label": "Engagement Potential", "value": "<rating: High/Medium/Low>", "description": "<factors affecting engagement + specific boost - NO abbreviations>" },
    { "icon": "<emoji>", "label": "Visual Quality", "value": "<rating: Professional/Good/Fair>", "description": "<production assessment + specific fix - NO abbreviations>" },
    { "icon": "<emoji>", "label": "Audio Quality", "value": "<rating: Clear/Muffled/Unbalanced>", "description": "<sound assessment + specific fix - NO abbreviations>" }
  ],
  "recommendations": [
    { "priority": "high", "category": "Hook", "text": "<specific, actionable hook improvement - NO abbreviations>" },
    { "priority": "med", "category": "Pacing", "text": "<specific pacing adjustment - NO abbreviations>" },
    { "priority": "med", "category": "Visual", "text": "<specific visual enhancement - NO abbreviations>" },
    { "priority": "med", "category": "Audio", "text": "<specific audio improvement - NO abbreviations>" },
    { "priority": "low", "category": "Metadata", "text": "<specific metadata optimization - NO abbreviations>" }
  ],
  "overlays": [
    { "type": "text",   "description": "<specific text overlay suggestion - NO abbreviations>", "timing": "<exact timestamp>" },
    { "type": "sound", "description": "<specific audio/music suggestion - NO abbreviations>", "timing": "<exact timestamp>" },
    { "type": "visual", "description": "<specific visual effect or edit - NO abbreviations>", "timing": "<exact timestamp>" },
    { "type": "cta",    "description": "<specific call-to-action - NO abbreviations>", "timing": "<exact timestamp>" }
  ],
  "titles": [
    "<optimized title option 1: 50-60 chars max, strong hook + keywords>",
    "<optimized title option 2: 50-60 chars max, strong hook + keywords>",
    "<optimized title option 3: 50-60 chars max, strong hook + keywords>"
  ],
  "description": "<optimized description: 150-200 characters, keywords + call to action, platform-optimized - NO abbreviations>",
  "tags": ["<15-20 specific, relevant hashtags for platform - mix of platform, content, game, context, and streaming tags>"]
}
IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside of JSON.
`
              }
            ]
          }
        ]
      })
      
      // Parse the response from Google GenAI SDK
      const content = geminiResponse.text || ''
      
      console.log('[DEBUG] Gemini raw response length:', content.length)
      console.log('[DEBUG] Gemini response preview:', content.substring(0, 200))
      
      if (content) {
        let cleanContent = content
        if (content.includes('```')) {
          cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          console.log('[DEBUG] Removed markdown code blocks from response')
        }
        
        try {
          analysisResult = JSON.parse(cleanContent)
          analysisSource = MODEL_NAME
          console.log('✅ [DEBUG] Gemini analysis successful - parsed JSON with keys:', Object.keys(analysisResult))
        } catch (parseError) {
          console.error('[DEBUG] JSON parse error:', parseError)
          console.error('[DEBUG] Failed content:', cleanContent.substring(0, 500))
          throw parseError
        }
      }
    } catch (geminiError: any) {
      console.error('Gemini analysis error:', geminiError)
      
      const errorMessage = geminiError.message || 'Unknown error'
      const errorDetails = `Model: ${MODEL_NAME}, Error: ${errorMessage}`
      
      return NextResponse.json({ 
        error: 'Analysis failed',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: errorDetails
      }, { status: 503 })
    }

    // Only Gemini - no fallbacks
    if (!analysisResult) {
      console.log(`[ACTIVITY_LOG] Clip Analyze: Gemini failed to analyze content`)
      
      return NextResponse.json({ 
        error: 'Analysis failed',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'Gemini API analysis failed'
      }, { status: 503 })
    }

    console.log('[DEBUG] Returning successful analysis response:', {
      hasScore: !!analysisResult?.score,
      hasInsights: !!analysisResult?.insights,
      hasRecommendations: !!analysisResult?.recommendations,
      analysisSource: analysisSource,
      extractedDataSize: JSON.stringify(extractedData).length
    })

    const response = NextResponse.json({
      ...analysisResult,
      extractedData: extractedData,
      analysisSource: analysisSource
    })

    return response
  } catch (error) {
    console.error('[DEBUG] Clip Analyze API: Unhandled error:', error)
    console.error('[DEBUG] Clip Analyze API: Error stack:', error instanceof Error ? error.stack : 'No stack available')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
