import { NextResponse } from 'next/server'
import { getFileFromR2, deleteFileFromR2 } from '@/lib/r2'

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
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const platform = formData.get('platform') as string
    const userId = formData.get('userId') as string
    const userType = formData.get('userType') as string
    const fileKey = formData.get('fileKey') as string | null
    const uploadMode = (formData.get('uploadMode') as string) || 'direct' // 'direct' or 'r2'

    let fileData: { name: string; size: number; type: string; buffer?: Buffer } | null = null

    if (uploadMode === 'r2' && fileKey) {
      // R2 mode: fetch file from R2 storage
      console.log(`Fetching file from R2: ${fileKey}`)
      const r2Buffer = await getFileFromR2(fileKey)
      
      if (!r2Buffer) {
        return NextResponse.json({ error: 'Failed to retrieve file from storage' }, { status: 500 })
      }

      // Extract filename from fileKey (format: uploads/timestamp-filename)
      const filename = fileKey.split('-').slice(1).join('-') || 'video.mp4'
      
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

      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024
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
    
    if (!groqApiKey && !rapidApiKey) {
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

    // Use GROQ to analyze the video file and provide algorithm recommendations
    let analysisResult = null
    let analysisSource = 'none'

    // Try GROQ first
    if (groqApiKey) {
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
- Provide 3 distinct title options with different hooks`
              },
              {
                role: 'user',
                content: `Analyze this video file for ${platform} optimization.

Video File Information:
- File Name: ${fileData.name}
- File Size: ${(fileData.size / (1024 * 1024)).toFixed(2)} MB
- File Type: ${fileData.type}
- Target Platform: ${platform}

ANALYSIS TASK:
Since this is a video file upload (not a URL), provide general optimization recommendations for ${platform} based on best practices. Assume this is typical content and provide:

1. A balanced score (around 60-75 for average content)
2. General insights about what makes content perform well on ${platform}
3. Specific recommendations for improving hook, pacing, visual quality, and audio
4. Concrete overlay/edit suggestions with timestamps
5. Platform-optimized metadata (3 title options, description, 15-20 tags)

Focus on actionable advice that applies to most video content on ${platform}.`
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

    // Fallback to RapidAPI if GROQ failed or is not available
    if (!analysisResult && rapidApiKey) {
      try {
        const rapidResponse = await fetch(`https://deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com'
          },
          body: JSON.stringify({
            model: 'deepseek-r1-zero',
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
- Provide 3 distinct title options with different hooks`
              },
              {
                role: 'user',
                content: `Analyze this video file for ${platform} optimization.

Video File Information:
- File Name: ${fileData.name}
- File Size: ${(fileData.size / (1024 * 1024)).toFixed(2)} MB
- File Type: ${fileData.type}
- Target Platform: ${platform}

ANALYSIS TASK:
Since this is a video file upload (not a URL), provide general optimization recommendations for ${platform} based on best practices. Assume this is typical content and provide:

1. A balanced score (around 60-75 for average content)
2. General insights about what makes content perform well on ${platform}
3. Specific recommendations for improving hook, pacing, visual quality, and audio
4. Concrete overlay/edit suggestions with timestamps
5. Platform-optimized metadata (3 title options, description, 15-20 tags)

Focus on actionable advice that applies to most video content on ${platform}.`
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        })

        if (rapidResponse.ok) {
          const rapidData = await rapidResponse.json()
          const content = rapidData.choices?.[0]?.message?.content || ''

          // Parse JSON from response (handle markdown code blocks if present)
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }

          analysisResult = JSON.parse(cleanContent)
          analysisSource = 'rapidapi'
        } else {
          const errorText = await rapidResponse.text()
          console.error('RapidAPI error:', errorText)
        }
      } catch (rapidError) {
        console.error('RapidAPI analysis error:', rapidError)
      }
    }

    if (!analysisResult) {
      return NextResponse.json({ error: 'Failed to analyze content from both GROQ and RapidAPI' }, { status: 500 })
    }

    // Auto-delete file from R2 after analysis (if using R2 mode)
    if (uploadMode === 'r2' && fileKey) {
      console.log(`Auto-deleting file from R2 after analysis: ${fileKey}`)
      await deleteFileFromR2(fileKey)
    }

    // Include extracted data in response for re-analysis
    const response = NextResponse.json({
      ...analysisResult,
      extractedData: extractedData,
      uploadMode: uploadMode
    })

    return response
  } catch (error) {
    console.error('Clip analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
