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

    console.log('Clip Analyzer API: Form data received:', { 
      hasFile: !!file, 
      platform, 
      userId, 
      userType 
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

    const rateLimit = checkRateLimit(`clip-analyzer-${identifier}`, maxUses)

    if (!rateLimit.allowed) {
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
        const ai = new GoogleGenAI({ apiKey: geminiApiKey })
        
        // Create a Blob from the buffer for upload
        const videoBlob = new Blob([fileData.buffer as BlobPart], { type: fileData.type })
        
        // Upload video file to Google (handles large files efficiently)
        console.log('[Clip Analyzer] Uploading video to Google File API...')
        const uploadedFile = await ai.files.upload({
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
          const fileStatus = await ai.files.get({ name: uploadedFile.name })
          fileState = fileStatus.state
          attempts++
        }
        
        if (fileState !== 'ACTIVE') {
          throw new Error(`Video failed to process. Final state: ${fileState}`)
        }
        
        console.log('[Clip Analyzer] Video processing complete. Analyzing with Gemini 3.1 Pro...')
        
        // Analyze video using the uploaded file reference
        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
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
1. **SUBJECT MATTER IDENTIFICATION**: What is the video about? Identify the main topic, theme, niche, and target audience.
2. **VISUAL ANALYSIS**: 
   - Scene-by-scene breakdown (first 3 seconds, middle, ending)
   - Camera angles, lighting, color grading
   - Visual effects, transitions, text overlays
   - Motion, energy, pacing throughout
   - Thumbnail-worthy moments
3. **AUDIO ANALYSIS**:
   - Speech/dialogue content (what is being said)
   - Background music genre, mood, energy level
   - Sound effects and their purpose
   - Audio quality (clarity, mixing, volume levels)
   - Voice tone and delivery style
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
- TikTok: Hook in first 1-2 seconds, completion rate, shares, saves, comments, trending audio, caption keywords
- Instagram Reels: First 3 seconds engagement, watch time, saves, shares, carousel swipe-through, music trending
- YouTube Shorts: First 1 second hook, watch time, click-through rate, retention, comments
- Facebook Reels: Early engagement, watch time, shares, comments, trending audio
- YouTube Long: First 5 seconds hook, retention, click-through rate, comments, likes, shares, title optimization, posting schedule

SCORING CRITERIA (0-100):
- Hook strength (first 1-3 seconds): 25 points
- Content engagement potential: 20 points
- Visual/audio quality: 15 points
- Platform-specific optimization: 20 points
- Metadata quality (title/description/tags): 20 points

IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.
`
                }
              ]
            }
          ]
        })
        
        // Parse the response from Google GenAI SDK
        const content = geminiResponse.text || ''
        
        if (content) {
          // Parse JSON from response (handle markdown code blocks if present)
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }
          
          analysisResult = JSON.parse(cleanContent)
          analysisSource = 'gemini-3.1-pro'
          console.log('✅ Gemini 3.1 Pro video analysis successful')
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
