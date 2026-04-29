import { NextResponse } from 'next/server'
import { getFileFromR2, deleteFileFromR2 } from '@/lib/r2'
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
    const fileKey = formData.get('fileKey') as string | null
    const uploadMode = (formData.get('uploadMode') as string) || 'direct' // 'direct' or 'r2'

    console.log('Clip Analyzer API: Form data received:', { 
      hasFile: !!file, 
      platform, 
      userId, 
      userType, 
      fileKey, 
      uploadMode 
    })

    let fileData: { name: string; size: number; type: string; buffer?: Buffer } | null = null

    if (uploadMode === 'r2' && fileKey) {
      // R2 mode: fetch file from R2 storage
      console.log(`Clip Analyzer API: R2 mode - fetching file from R2: ${fileKey}`)
      const r2Buffer = await getFileFromR2(fileKey)
      
      if (!r2Buffer) {
        console.error(`Clip Analyzer API: Failed to retrieve file from R2: ${fileKey}`)
        return NextResponse.json({ error: `Failed to retrieve file from R2 storage: ${fileKey}` }, { status: 500 })
      }

      // Extract filename from fileKey (format: uploads/timestamp-filename)
      const filename = fileKey.split('-').slice(1).join('-') || 'video.mp4'
      
      // Validate minimum size for R2 files too
      const minSizeR2 = 100 * 1024 // 100KB minimum
      if (r2Buffer.length < minSizeR2) {
        return NextResponse.json({ error: 'File size is too small. Video must be at least 100KB to analyze properly.' }, { status: 400 })
      }

      fileData = {
        name: filename,
        size: r2Buffer.length,
        type: 'video/mp4', // Assume MP4, could be improved
        buffer: r2Buffer
      }

      console.log(`Retrieved file from R2: ${filename} (${(r2Buffer.length / (1024 * 1024)).toFixed(2)} MB)`)
    } else if (file) {
      // Direct upload mode
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Please upload MP4, WebM, MOV, or AVI.' }, { status: 400 })
      }

      // Validate file size (min 100KB, max 100MB)
      const minSize = 100 * 1024 // 100KB minimum
      const maxSize = 100 * 1024 * 1024 // 100MB maximum
      if (file.size < minSize) {
        return NextResponse.json({ error: 'File size is too small. Video must be at least 100KB to analyze properly.' }, { status: 400 })
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'File size must be less than 100MB. Use R2 upload for larger files.' }, { status: 400 })
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

    const groqApiKey = process.env.GROQ_API_KEY
    const rapidApiKey = process.env.RAPID_API_KEY
    const geminiApiKey = process.env.GEMINI_API
    
    if (!groqApiKey && !rapidApiKey && !geminiApiKey) {
      return NextResponse.json({ error: 'No content analysis API key configured' }, { status: 500 })
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
      source: uploadMode === 'r2' ? 'r2-storage' : 'direct-upload'
    }

    // Use AI to analyze the video file and provide algorithm recommendations
    let analysisResult = null
    let analysisSource = 'none'

    // Try Official Google Gemini 3.1 Pro via File API (supports up to 100MB+ videos)
    // No base64 encoding needed - uploads directly to Google servers
    const GEMINI_FILE_SIZE_LIMIT = 100 * 1024 * 1024 // 100MB limit
    
    if (geminiApiKey && fileData.buffer && fileData.size <= GEMINI_FILE_SIZE_LIMIT) {
      console.log(`File size ${(fileData.size / (1024 * 1024)).toFixed(2)}MB is within Gemini 3.1 Pro File API limit (100MB)`)
      try {
        console.log('Starting Gemini 3.1 Pro video analysis via Google GenAI File API...')
        
        // Initialize Google GenAI client
        const ai = new GoogleGenAI({ apiKey: geminiApiKey })
        
        // Create a Blob from the buffer for upload
        const videoBlob = new Blob([fileData.buffer], { type: fileData.type })
        
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
      } catch (geminiError) {
        console.error('Gemini 3.1 Pro analysis error:', geminiError)
      }
    } else if (geminiApiKey && fileData.size > GEMINI_FILE_SIZE_LIMIT) {
      console.log(`⚠️ WARNING: File size ${(fileData.size / (1024 * 1024)).toFixed(2)}MB exceeds Gemini 3.1 Pro File API limit (100MB)`)
      console.log(`⚠️ Video will NOT be analyzed by Gemini - using fallback analysis`)
    }

    // TEMPORARY: Test RapidAPI endpoints for larger files (DEPLOYED)
    // Cascading test: Llama → ChatGPT → Chat → Groq → Pollinations
    const tempRapidApiKey = process.env.RAPID_API_TEMP_API
    const rapidApiEndpoints = [
      { name: 'Llama 3.3 70B', url: 'https://open-ai21.p.rapidapi.com/conversationllama' },
      { name: 'ChatGPT 3.5', url: 'https://open-ai21.p.rapidapi.com/chatgpt' },
      { name: 'Chat Bot', url: 'https://open-ai21.p.rapidapi.com/chatbotapi' }
    ]

    if (!analysisResult && tempRapidApiKey && fileData.buffer) {
      const base64Video = fileData.buffer.toString('base64')
      
      // Skip RapidAPI test if payload is too large (max 30MB base64 ~ 22MB raw)
      const MAX_RAPIDAPI_PAYLOAD = 30 * 1024 * 1024 // 30MB
      if (base64Video.length > MAX_RAPIDAPI_PAYLOAD) {
        console.log(`[Clip Analyzer] Skipping RapidAPI test - base64 payload ${(base64Video.length / (1024 * 1024)).toFixed(2)}MB exceeds 30MB limit`)
      } else {
        console.log(`[Clip Analyzer] RapidAPI payload size: ${(base64Video.length / (1024 * 1024)).toFixed(2)}MB - attempting endpoints...`)
        
        for (const endpoint of rapidApiEndpoints) {
        if (analysisResult) break // Stop if we got a result
        
        console.log(`[Clip Analyzer] Testing ${endpoint.name} for video analysis...`)
        try {
          // Create abort controller for timeout (30 second limit per endpoint)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)
          
          const rapidResponse = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-RapidAPI-Key': tempRapidApiKey,
              'X-RapidAPI-Host': 'open-ai21.p.rapidapi.com'
            },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [
                {
                  role: 'user',
                  content: `You are an expert social media algorithm analyst. Analyze this ${platform} video and return ONLY a JSON object with no markdown formatting. 

Return this exact structure:
{
  "score": <integer 0-100>,
  "scoreTitle": "<rating title>",
  "scoreSummary": "<2 sentence summary>",
  "insights": [
    { "icon": "🎣", "label": "Hook Strength", "value": "<rating>", "description": "<analysis>" },
    { "icon": "⚡", "label": "Engagement Potential", "value": "<rating>", "description": "<analysis>" },
    { "icon": "🎥", "label": "Visual Quality", "value": "<rating>", "description": "<analysis>" },
    { "icon": "🔊", "label": "Audio Quality", "value": "<rating>", "description": "<analysis>" }
  ],
  "recommendations": [
    { "priority": "high", "category": "Hook", "text": "<specific recommendation>" },
    { "priority": "high", "category": "Pacing", "text": "<specific recommendation>" },
    { "priority": "med", "category": "Visual", "text": "<specific recommendation>" },
    { "priority": "med", "category": "Audio", "text": "<specific recommendation>" },
    { "priority": "low", "category": "Metadata", "text": "<specific recommendation>" }
  ],
  "overlays": [
    { "type": "text", "description": "<suggestion>", "timing": "<timestamp>" },
    { "type": "sound", "description": "<suggestion>", "timing": "<timestamp>" },
    { "type": "visual", "description": "<suggestion>", "timing": "<timestamp>" },
    { "type": "cta", "description": "<suggestion>", "timing": "<timestamp>" }
  ],
  "titles": ["<title 1>", "<title 2>", "<title 3>"],
  "description": "<description>",
  "tags": ["<tag1>", "<tag2>", "...15-20 tags"]
}

IMPORTANT: 
- Analyze the video content for ${platform} optimization
- Provide specific, actionable recommendations with timestamps
- Return ONLY valid JSON, no markdown code blocks, no extra text
- Platform: ${platform}

Video: data:${fileData.type};base64,${base64Video}`
                }
              ]
            })
          })

          clearTimeout(timeoutId) // Clear timeout on success
          
          if (rapidResponse.ok) {
            const rapidData = await rapidResponse.json()
            const content = rapidData.result || rapidData.message || rapidData.content || rapidData.choices?.[0]?.message?.content || ''
            
            if (content) {
              let cleanContent = content
              if (content.includes('```')) {
                cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
              }
              
              try {
                analysisResult = JSON.parse(cleanContent)
                analysisSource = `${endpoint.name.toLowerCase().replace(/\s+/g, '-')}-rapidapi`
                console.log(`✅ ${endpoint.name} RapidAPI analysis successful`)
                break // Exit loop on success
              } catch (parseError) {
                console.error(`[Clip Analyzer] ${endpoint.name} JSON parse error:`, parseError)
              }
            }
          } else {
            const errorText = await rapidResponse.text()
            console.error(`[Clip Analyzer] ${endpoint.name} error:`, rapidResponse.status, errorText.substring(0, 200))
          }
        } catch (endpointError) {
          clearTimeout(timeoutId) // Clear timeout on error too
          if (endpointError.name === 'AbortError') {
            console.error(`[Clip Analyzer] ${endpoint.name} timed out after 30s`)
          } else {
            console.error(`[Clip Analyzer] ${endpoint.name} analysis error:`, endpointError)
          }
        }
      }
    }

    // Fallback to GROQ if Gemini/Llama failed or no video buffer
    if (!analysisResult && groqApiKey) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `You are an expert social media algorithm analyst and content optimization specialist. Your task is to analyze video content and provide specific, actionable recommendations for ${platform}.

PLATFORM-SPECIFIC ALGORITHM PRIORITIES (2026):
- TikTok: Hook in first 1-2 seconds, completion rate (watch to end), shares, saves, comments, trending audio usage, caption keywords, posting consistency, niche authority
- Instagram Reels: First 3 seconds engagement, watch time, saves, shares, carousel swipe-through, music trending, hashtags, Reels tab exploration, consistency
- YouTube Shorts: First 1 second hook, watch time, click-through rate, retention, comments, likes, shares, title optimization, posting schedule
- Facebook Reels: Early engagement, watch time, shares, comments, trending audio, hashtags, Reels tab exploration
- YouTube Long: First 5 seconds hook, retention, click-through rate, comments, likes, shares, title optimization, description keywords, posting schedule

SCORING CRITERIA (0-100):
- Hook strength (first 1-3 seconds): 25 points
- Content engagement potential: 20 points
- Visual/audio quality: 15 points
- Platform-specific optimization: 20 points
- Metadata quality (title/description/tags): 20 points

IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.

Return this exact structure:
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
  "tags": ["<15-20 specific, relevant hashtags for platform>"]
}

GUIDELINES:
- Be specific and actionable in all recommendations
- Use concrete examples (e.g., "Add text overlay at 0:02" not "Add text overlay")
- Focus on platform-specific best practices
- Ensure suggestions are practical and implementable
- Keep descriptions concise but informative
- Score realistically based on typical content quality (give a balanced score around 60-75 for average content)
- NEVER use abbreviations (write "description" not "desc", "information" not "info", "second" not "sec")
- Provide 15-20 relevant, specific hashtags
- Include 1-2 relevant emojis in each title suggestion
- NEVER use HTML tags like <b> or <i> - use plain text only
- Provide 3 distinct title options with different hooks and emojis`
              },
              {
                role: 'user',
                content: `IMPORTANT LIMITATION: You CANNOT see this video file. It was too large to process. You must provide GENERAL platform optimization advice for ${platform} based on best practices only.

Target Platform: ${platform}

ANALYSIS TASK - GENERIC RECOMMENDATIONS ONLY:
Since you cannot analyze the actual video content, provide:

1. A balanced score (65-75 for typical content)
2. Platform-specific best practices for ${platform} (generic insights)
3. General recommendations for hook, pacing, visual, audio (typical advice)
4. Example overlay suggestions (not specific to any content)
5. Platform-optimized metadata templates (generic titles, description, tags for ${platform})

LABEL ALL RECOMMENDATIONS AS "General Best Practice" so users know these are not AI-analyzed from their video.

Do NOT pretend to analyze video content you cannot see.`
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        })

        if (groqResponse.ok) {
          const groqData = await groqResponse.json()
          const content = groqData.choices[0]?.message?.content || ''

          // Parse JSON from response (handle markdown code blocks if present)
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }

          analysisResult = JSON.parse(cleanContent)
          analysisSource = 'groq'
        } else {
          const errorText = await groqResponse.text()
          console.error('GROQ error:', errorText)
        }
      } catch (groqError) {
        console.error('GROQ analysis error:', groqError)
      }
    }

    // Fallback to Pollinations if GROQ failed (final backup)
    const pollinationsApiKey = process.env.POLLINATIONS_API_KEY
    if (!analysisResult && pollinationsApiKey) {
      try {
        console.log('[Clip Analyzer] Falling back to Pollinations for analysis')
        const pollinationsResponse = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pollinationsApiKey}`
          },
          body: JSON.stringify({
            model: 'openai',
            messages: [
              {
                role: 'system',
                content: `You are an expert social media algorithm analyst. Analyze video content for ${platform} and return JSON with: score (0-100), scoreTitle, scoreSummary, insights (array with icon/label/value/description), recommendations (array with priority/category/text), overlays (array with type/description/timing), titles (array of 3), description (string), tags (array of 15-20). Provide general best practices since you cannot see the video.`
              },
              {
                role: 'user',
                content: `Provide general optimization recommendations for ${platform} based on current best practices for video content.`
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        })

        if (pollinationsResponse.ok) {
          const pollinationsData = await pollinationsResponse.json()
          const content = pollinationsData.choices?.[0]?.message?.content || ''

          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }

          analysisResult = JSON.parse(cleanContent)
          analysisSource = 'pollinations'
          console.log('[Clip Analyzer] Pollinations analysis completed')
        } else {
          const errorText = await pollinationsResponse.text()
          console.error('[Clip Analyzer] Pollinations error:', errorText)
        }
      } catch (pollinationsError) {
        console.error('[Clip Analyzer] Pollinations analysis error:', pollinationsError)
      }
    }

    if (!analysisResult) {
      return NextResponse.json({ error: 'Failed to analyze content from Gemini 2.5 Pro, GROQ, and Pollinations' }, { status: 500 })
    }

    // Auto-delete file from R2 after analysis (if using R2 mode)
    if (uploadMode === 'r2' && fileKey) {
      console.log(`Auto-deleting file from R2 after analysis: ${fileKey}`)
      await deleteFileFromR2(fileKey)
    }

    // Include extracted data and analysis source in response
    const response = NextResponse.json({
      ...analysisResult,
      extractedData: extractedData,
      uploadMode: uploadMode,
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
