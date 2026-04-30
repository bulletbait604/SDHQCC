import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

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
  try {
    console.log('Clip Analyzer API: Request received')
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const platform = formData.get('platform') as string
    const userId = formData.get('userId') as string
    const userType = formData.get('userType') as string

    console.log('[DEBUG] Clip Analyzer API: Form data received:', { 
      hasFile: !!file, 
      platform, 
      userId, 
      userType,
      timestamp: new Date().toISOString()
    })

    let fileData: { name: string; size: number; type: string; buffer?: Buffer } | null = null

    if (file) {
      // Direct upload mode
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Please upload MP4, WebM, MOV, or AVI.' }, { status: 400 })
      }

      // Validate file size (min 100KB, max 500MB for Google Gemini File API)
      const minSize = 100 * 1024 // 100KB minimum
      const maxSize = 500 * 1024 * 1024 // 500MB maximum (Gemini File API supports large files)
      if (file.size < minSize) {
        return NextResponse.json({ error: 'File size is too small. Video must be at least 100KB to analyze properly.' }, { status: 400 })
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'File size must be less than 500MB. Please use a smaller video file.' }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        buffer: Buffer.from(arrayBuffer)
      }
      console.log('[DEBUG] File processed:', { 
        name: fileData.name, 
        sizeMB: (fileData.size / (1024 * 1024)).toFixed(2),
        type: fileData.type 
      })
    } else {
      return NextResponse.json({ error: 'File or fileKey is required' }, { status: 400 })
    }

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }

    // Rate limiting
    const identifier = userId || 'anonymous'
    let maxUses = 5 // Default for subscribers

    if (userType === 'owner' || userType === 'admin' || userType === 'lifetime') {
      maxUses = 999999 // Unlimited
    } else if (userType === 'subscribed') {
      maxUses = 5
    } else {
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    console.log('[DEBUG] Rate limiting:', { identifier, maxUses, userType })
    
    const rateLimit = checkRateLimit(`clip-analyzer-${identifier}`, maxUses)
    
    console.log('[DEBUG] Rate limit result:', { allowed: rateLimit.allowed, remaining: rateLimit.remaining })

    if (!rateLimit.allowed) {
      console.log('[ACTIVITY_LOG] Clip Analyzer: Rate limit exceeded for', identifier)
      return NextResponse.json(
        { error: 'Rate limit exceeded. You have used your daily limit.', resetTime: rateLimit.resetTime },
        { status: 429 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API
    
    if (!geminiApiKey) {
      console.log('[ACTIVITY_LOG] Clip Analyzer: GEMINI_API key not configured')
      return NextResponse.json({ 
        error: 'API not configured',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'GEMINI_API key not configured'
      }, { status: 503 })
    }

    // Create basic extracted data from file metadata
    const extractedData = {
      fileName: fileData.name,
      fileSize: fileData.size,
      fileType: fileData.type,
      duration: 'Unknown (requires video processing)',
      summary: `Uploaded video file: ${fileData.name} (${(fileData.size / (1024 * 1024)).toFixed(2)} MB)`,
      visualAnalysis: 'Video file uploaded for analysis',
      audioAnalysis: 'Video file uploaded for analysis',
      topics: [],
      keyPoints: [],
      source: 'direct-upload'
    }

    // Use AI to analyze the video file and provide algorithm recommendations
    let analysisResult = null
    let analysisSource = 'none'

    // Try Official Google Gemini 3.1 Pro via File API (supports up to 500MB+ videos)
    // No base64 encoding needed - uploads directly to Google servers
    const GEMINI_FILE_SIZE_LIMIT = 500 * 1024 * 1024 // 500MB limit for paid Google API
    
    if (geminiApiKey && fileData.buffer && fileData.size <= GEMINI_FILE_SIZE_LIMIT) {
      console.log(`File size ${(fileData.size / (1024 * 1024)).toFixed(2)}MB is within Gemini 3.1 Pro File API limit (500MB)`)
      try {
        console.log('Starting Gemini 3.1 Pro video analysis via Google GenAI File API...')
        
        // Initialize Google GenAI client
        const genAI = new GoogleGenAI({ apiKey: geminiApiKey })
        
        // Create a Blob from the buffer for upload
        const videoBlob = new Blob([fileData.buffer as BlobPart], { type: fileData.type })
        
        // Upload video file to Google (handles large files efficiently)
        console.log('[Clip Analyzer] Uploading video to Google File API...')
        const uploadedFile = await genAI.files.upload({
          file: videoBlob,
          config: { mimeType: fileData.type }
        })
        
        console.log(`[Clip Analyzer] Video uploaded: ${uploadedFile.name}, state: ${uploadedFile.state}`)
        
        // Wait for video processing to complete
        let fileState = uploadedFile.state
        let attempts = 0
        const maxAttempts = 60 // 5 minutes max (5s * 60)
        
        while (fileState === 'PROCESSING' && attempts < maxAttempts) {
          console.log(`[Clip Analyzer] Video processing... attempt ${attempts + 1}/${maxAttempts}`)
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
          
          if (!uploadedFile.name) {
            throw new Error('Uploaded file name is undefined')
          }
          const fileStatus = await genAI.files.get({ name: uploadedFile.name })
          fileState = fileStatus.state
          attempts++
        }
        
        if (fileState !== 'ACTIVE') {
          throw new Error(`Video failed to process. Final state: ${fileState}`)
        }
        
        console.log('[Clip Analyzer] Video processing complete. Analyzing with Gemini 3 Flash Preview (v1beta endpoint)...')
        
        // Analyze video using the uploaded file reference
        const geminiResponse = await genAI.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  fileData: {
                    mimeType: uploadedFile.mimeType,
                    fileUri: uploadedFile.uri
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

PLATFORM-SPECIFIC ALGORITHM PRIORITIES (2026):
- TikTok: Hook in first 1-2 seconds, completion rate, shares, saves, comments, trending audio, caption keywords, niche authority
- Instagram Reels: First 3 seconds engagement, watch time, saves, shares, carousel swipe-through, music trending, hashtags, Reels tab exploration
- YouTube Shorts: First 1 second hook, watch time, click-through rate, retention, comments, likes, shares, title optimization, posting schedule
- Facebook Reels: Early engagement, watch time, shares, comments, trending audio
- YouTube Long: First 5 seconds hook, retention, click-through rate, comments, likes, shares, title optimization, posting schedule, description keywords
- Twitch Clips: Highlight moments, community engagement, game/category relevance, editing pace, audio clarity, discoverability through recommendations
- Kick Clips: Early engagement, community interaction, category relevance, trending topics, audio quality, visual appeal, shareability

SCORING CRITERIA (0-100):
- Hook strength (first 1-3 seconds): 25 points
- Content engagement potential: 20 points
- Visual/audio quality: 15 points
- Platform-specific optimization: 20 points
- Metadata quality (title/description/tags): 20 points

TAG REQUIREMENTS (15-20 tags total):
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
    { "priority": "high", "category": "Pacing", "text": "<specific pacing adjustment - NO abbreviations>" },
    { "priority": "med",  "category": "Visual", "text": "<specific visual enhancement - NO abbreviations>" },
    { "priority": "med",  "category": "Audio", "text": "<specific audio improvement - NO abbreviations>" },
    { "priority": "low",  "category": "Metadata", "text": "<specific metadata optimization - NO abbreviations>" }
  ],
  "overlays": [
    { "type": "text",   "description": "<specific text overlay suggestion - NO abbreviations>", "timing": "<exact timestamp>" },
    { "type": "sound",  "description": "<specific audio/music suggestion - NO abbreviations>", "timing": "<exact timestamp>" },
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

IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.
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
          // Parse JSON from response (handle markdown code blocks if present)
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            console.log('[DEBUG] Removed markdown code blocks from response')
          }
          
          try {
            analysisResult = JSON.parse(cleanContent)
            analysisSource = 'gemini-3.1-pro'
            console.log('✅ [DEBUG] Gemini 3.1 Pro video analysis successful - parsed JSON with keys:', Object.keys(analysisResult))
          } catch (parseError) {
            console.error('[DEBUG] JSON parse error:', parseError)
            console.error('[DEBUG] Failed content:', cleanContent.substring(0, 500))
            throw parseError
          }
        }
      } catch (geminiError: any) {
        console.error('Gemini 3.1 Pro analysis error:', geminiError)
        
        // Log specific error details to activity log
        if (geminiError.message?.includes('quota')) {
          console.log('[ACTIVITY_LOG] Clip Analyzer: Gemini 3.1 Pro API quota exceeded. Please upgrade plan.')
        } else if (geminiError.message?.includes('permission') || geminiError.message?.includes('unauthorized')) {
          console.log('[ACTIVITY_LOG] Clip Analyzer: Gemini 3.1 Pro API key invalid or unauthorized.')
        } else if (geminiError.message?.includes('rate')) {
          console.log('[ACTIVITY_LOG] Clip Analyzer: Gemini 3.1 Pro API rate limit exceeded.')
        } else {
          console.log(`[ACTIVITY_LOG] Clip Analyzer: Gemini 3.1 Pro API error - ${geminiError.message || 'Unknown error'}`)
        }
      }
    } else if (fileData.size > GEMINI_FILE_SIZE_LIMIT) {
      // Log to activity log
      console.log(`[ACTIVITY_LOG] Clip Analyzer: File size ${(fileData.size / (1024 * 1024)).toFixed(2)}MB exceeds 500MB limit`)
      
      return NextResponse.json({ 
        error: 'File too large',
        userMessage: 'This video is too large for AI analysis. Please upload a video under 500MB.',
        details: `File size: ${(fileData.size / (1024 * 1024)).toFixed(2)}MB (limit: 500MB)`
      }, { status: 413 })
    }

    // Only Gemini 3.1 Pro - no fallbacks
    if (!analysisResult) {
      // Log the error for activity tracking
      console.log(`[ACTIVITY_LOG] Clip Analyzer: Gemini 3.1 Pro failed to analyze video`)
      
      return NextResponse.json({ 
        error: 'Analysis failed',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'Gemini 3.1 Pro API analysis failed'
      }, { status: 503 })
    }

    // Return analysis results
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
    console.error('Clip Analyzer API: Unhandled error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Clip Analyzer API: Error details:', errorMessage)
    console.error('Clip Analyzer API: Error stack:', errorStack)
    return NextResponse.json({ 
      error: `Clip analysis failed: ${errorMessage}`,
      details: errorStack || 'No stack trace available'
    }, { status: 500 })
  }
}
