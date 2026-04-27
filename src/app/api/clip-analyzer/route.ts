import { NextResponse } from 'next/server'

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
    const body = await request.json()
    const { url, platform, userId, userType } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
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

    const supadataApiKey = process.env.SUPADATA_API_KEY
    const rapidApiKey = process.env.RAPID_API_KEY
    const pollinationsApiKey = process.env.POLLINATIONS_API_KEY
    
    if (!supadataApiKey && !rapidApiKey && !pollinationsApiKey) {
      return NextResponse.json({ error: 'No video extraction API key configured' }, { status: 500 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ API key not configured' }, { status: 500 })
    }

    // Step 1: Extract video information using Supadata (with RapidAPI fallback)
    let supadataResult = null
    let extractionSource = 'none'

    // Try Supadata first
    if (supadataApiKey) {
      try {
        console.log('Starting Supadata extraction for URL:', url)
        const supadataResponse = await fetch('https://api.supadata.ai/v1/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': supadataApiKey
          },
          body: JSON.stringify({
            url: url,
            prompt: 'Extract comprehensive information about this video including: main topics and themes, key points discussed, visual elements (people, objects, scenes, colors, text overlays, graphics), audio content (speech/transcript, music, sound effects, background audio), captions/subtitles, engagement indicators, pacing, editing style, hook strength, production quality, and any other relevant metadata. Provide a detailed summary of both visual and audio content to give full context for algorithm analysis.'
          })
        })

        if (supadataResponse.ok) {
          const supadataJob = await supadataResponse.json()
          console.log('Supadata job created:', supadataJob.jobId)

          // Poll for Supadata results
          let attempts = 0
          const maxAttempts = 30 // 30 attempts with 2 second delay = 60 seconds max

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
            
            const resultResponse = await fetch(`https://api.supadata.ai/v1/extract/${supadataJob.jobId}`, {
              headers: {
                'x-api-key': supadataApiKey
              }
            })

            if (resultResponse.ok) {
              const resultData = await resultResponse.json()
              if (resultData.status === 'completed') {
                supadataResult = resultData.data
                extractionSource = 'supadata'
                break
              } else if (resultData.status === 'failed') {
                console.log('Supadata extraction failed, trying fallback')
                break
              }
            }
            
            attempts++
          }

          if (supadataResult) {
            console.log('Supadata extraction completed')
          } else {
            console.log('Supadata extraction timed out, trying fallback')
          }
        } else {
          const errorText = await supadataResponse.text()
          console.error('Supadata error:', errorText)
        }
      } catch (supadataError) {
        console.error('Supadata extraction error:', supadataError)
      }
    }

    // Fallback to RapidAPI if Supadata failed or is not available
    if (!supadataResult && rapidApiKey) {
      try {
        console.log('Falling back to RapidAPI for video extraction')
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
                content: 'You are a video content analyzer. Extract comprehensive information about the video at the given URL including: main topics and themes, key points discussed, visual elements (people, objects, scenes, colors, text overlays, graphics), audio content (speech/transcript, music, sound effects, background audio), captions/subtitles, engagement indicators, pacing, editing style, hook strength, production quality. Return the analysis as a structured JSON object with fields: topics, keyPoints, visualElements, audioContent, captions, pacing, editingStyle, hookStrength, productionQuality, summary.'
              },
              {
                role: 'user',
                content: `Analyze this video URL: ${url}. Provide a comprehensive analysis of the content including visual and audio elements, topics discussed, pacing, and production quality.`
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        })

        if (rapidResponse.ok) {
          const rapidData = await rapidResponse.json()
          const content = rapidData.choices?.[0]?.message?.content || ''
          
          // Parse the response to extract structured data
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }

          try {
            const parsedData = JSON.parse(cleanContent)
            // Format the RapidAPI response to match Supadata structure
            supadataResult = {
              ...parsedData,
              summary: parsedData.summary || 'Video analysis completed via RapidAPI',
              transcript: parsedData.audioContent?.transcript || '',
              visualAnalysis: parsedData.visualElements || '',
              audioAnalysis: parsedData.audioContent || ''
            }
            extractionSource = 'rapidapi'
            console.log('RapidAPI extraction completed')
          } catch (parseError) {
            // If JSON parsing fails, create a basic structure from the text
            supadataResult = {
              summary: cleanContent,
              transcript: '',
              visualAnalysis: cleanContent,
              audioAnalysis: cleanContent,
              topics: [],
              keyPoints: []
            }
            extractionSource = 'rapidapi'
            console.log('RapidAPI extraction completed (text fallback)')
          }
        } else {
          const errorText = await rapidResponse.text()
          console.error('RapidAPI error:', errorText)
        }
      } catch (rapidError) {
        console.error('RapidAPI extraction error:', rapidError)
      }
    }

    // Fallback to Pollinations if both Supadata and RapidAPI failed
    if (!supadataResult && pollinationsApiKey) {
      try {
        console.log('Falling back to Pollinations for video extraction')
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
                content: 'You are a video content analyzer. Extract comprehensive information about the video at the given URL including: main topics and themes, key points discussed, visual elements (people, objects, scenes, colors, text overlays, graphics), audio content (speech/transcript, music, sound effects, background audio), captions/subtitles, engagement indicators, pacing, editing style, hook strength, production quality. Return the analysis as a structured JSON object with fields: topics, keyPoints, visualElements, audioContent, captions, pacing, editingStyle, hookStrength, productionQuality, summary.'
              },
              {
                role: 'user',
                content: `Analyze this video URL: ${url}. Provide a comprehensive analysis of the content including visual and audio elements, topics discussed, pacing, and production quality.`
              }
            ],
            max_tokens: 2000,
            temperature: 0.7,
            reasoning_effort: 'medium'
          })
        })

        if (pollinationsResponse.ok) {
          const pollinationsData = await pollinationsResponse.json()
          const content = pollinationsData.choices?.[0]?.message?.content || ''
          
          // Parse the response to extract structured data
          let cleanContent = content
          if (content.includes('```')) {
            cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          }

          try {
            const parsedData = JSON.parse(cleanContent)
            // Format the Pollinations response to match Supadata structure
            supadataResult = {
              ...parsedData,
              summary: parsedData.summary || 'Video analysis completed via Pollinations',
              transcript: parsedData.audioContent?.transcript || '',
              visualAnalysis: parsedData.visualElements || '',
              audioAnalysis: parsedData.audioContent || ''
            }
            extractionSource = 'pollinations'
            console.log('Pollinations extraction completed')
          } catch (parseError) {
            // If JSON parsing fails, create a basic structure from the text
            supadataResult = {
              summary: cleanContent,
              transcript: '',
              visualAnalysis: cleanContent,
              audioAnalysis: cleanContent,
              topics: [],
              keyPoints: []
            }
            extractionSource = 'pollinations'
            console.log('Pollinations extraction completed (text fallback)')
          }
        } else {
          const errorText = await pollinationsResponse.text()
          console.error('Pollinations error:', errorText)
        }
      } catch (pollinationsError) {
        console.error('Pollinations extraction error:', pollinationsError)
      }
    }

    if (!supadataResult) {
      return NextResponse.json({ error: 'Failed to extract video information from Supadata, RapidAPI, and Pollinations' }, { status: 500 })
    }

    console.log(`Video extraction completed using: ${extractionSource}`)

    // Step 2: Use GROQ to analyze the extracted information and research algorithms
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
- Twitch Clips: Highlight moments, community engagement, game/category relevance, editing pace, audio clarity, discoverability through recommendations
- Kick Clips: Early engagement, community interaction, category relevance, trending topics, audio quality, visual appeal, shareability

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
- Score realistically based on actual content quality
- NEVER use abbreviations (write "description" not "desc", "information" not "info", "second" not "sec")
- Provide 15-20 relevant, specific hashtags
- Provide 3 distinct title options with different hooks`
          },
          {
            role: 'user',
            content: `Analyze this video content for ${platform} optimization.

Video Information:
${JSON.stringify(supadataResult, null, 2)}

ANALYSIS TASK:
1. Evaluate the video against ${platform}'s specific algorithm priorities listed above
2. Score each category (hook, engagement, quality, optimization, metadata) based on the criteria
3. Provide specific, actionable improvements for each recommendation
4. Suggest concrete overlay/edit ideas with exact timestamps
5. Create platform-optimized metadata (title, description, tags)

REQUIREMENTS:
- Score honestly based on actual content quality
- Recommendations must be specific (e.g., "Add text 'Follow for more' at 0:03" not "Add text")
- Focus on the most impactful improvements first (high priority)
- Ensure metadata follows platform best practices (character limits, keyword placement)
- Tags should be relevant, specific, and trending for the platform
- All suggestions should be practical and immediately implementable

Generate the analysis following the exact JSON structure provided.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('GROQ error:', errorText)
      throw new Error(`GROQ API error: ${groqResponse.status} - ${errorText}`)
    }

    const groqData = await groqResponse.json()
    console.log('GROQ Response:', JSON.stringify(groqData, null, 2))

    const content = groqData.choices[0]?.message?.content || ''
    
    console.log('GROQ response content length:', content.length)
    console.log('GROQ response content preview:', content.substring(0, 200))

    // Parse JSON from response (handle markdown code blocks if present)
    let cleanContent = content
    if (content.includes('```')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    console.log('Cleaned content preview:', cleanContent.substring(0, 200))

    const result = JSON.parse(cleanContent)
    console.log('Parsed result keys:', Object.keys(result))

    // Include extracted data in response for re-analysis
    const response = NextResponse.json({
      ...result,
      extractedData: supadataResult
    })

    return response
  } catch (error) {
    console.error('Clip analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
