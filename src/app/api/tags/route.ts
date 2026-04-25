import { NextResponse } from 'next/server'
import { hashy } from '../../../../lib/hashy/hashy-algorithm'

// OpenAI API integration for smart tag generation
async function generateTagsWithAI(description: string, platform: string, count: number): Promise<string[] | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  
  if (!openaiKey && !deepseekKey) {
    return null
  }

  const prompt = `Generate ${count} highly relevant hashtags for ${platform} based on this content: "${description}"

Requirements:
- Return ONLY a JSON array of hashtag strings (without the # symbol)
- Tags should be specific to ${platform}'s algorithm and best practices
- Include trending, niche, and discoverability-focused tags
- Mix of broad and specific tags for optimal reach
- No generic tags like #fyp, #viral, #trending unless truly relevant
- Focus on content-specific, platform-optimized tags

Return format: ["tag1", "tag2", "tag3", ...]`

  try {
    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are an expert social media tag generator specializing in platform-specific algorithm optimization.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      const parsed = JSON.parse(content || '[]')
      return parsed.tags || parsed
    } else {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey: openaiKey })
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert social media tag generator specializing in platform-specific algorithm optimization.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0].message.content
      const parsed = JSON.parse(content || '[]')
      return parsed.tags || parsed
    }
  } catch (error) {
    console.error('Error generating tags with AI:', error)
    return null
  }
}

// Google Cloud Natural Language API integration for entity extraction
async function extractEntitiesWithGoogle(description: string): Promise<{ entities: string[], categories: string[], sentiment: string }> {
  const apiKey = process.env.GOOGLE_API_KEY
  
  if (!apiKey) {
    return { entities: [], categories: [], sentiment: 'neutral' }
  }
  
  try {
    const entityResponse = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: { content: description, type: 'PLAIN_TEXT' },
          encodingType: 'UTF8',
        }),
      }
    )
    
    const sentimentResponse = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: { content: description, type: 'PLAIN_TEXT' },
          encodingType: 'UTF8',
        }),
      }
    )
    
    const classifyResponse = await fetch(
      `https://language.googleapis.com/v1/documents:classifyText?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: { content: description, type: 'PLAIN_TEXT' },
          encodingType: 'UTF8',
        }),
      }
    )
    
    const extractedTerms: string[] = []
    const categories: string[] = []
    let sentiment = 'neutral'
    
    if (entityResponse.ok) {
      const entityData = await entityResponse.json()
      const entities = entityData.entities || []
      
      for (const entity of entities) {
        if (entity.name) {
          extractedTerms.push(entity.name.toLowerCase())
        }
        
        if (entity.metadata && entity.metadata.wikipedia_url) {
          const wikiMatch = entity.metadata.wikipedia_url.match(/\/wiki\/([^\/]+)$/)
          if (wikiMatch) {
            extractedTerms.push(wikiMatch[1].toLowerCase().replace(/_/g, ' '))
          }
        }
        
        if (entity.mentions && entity.mentions.length > 0) {
          for (const mention of entity.mentions) {
            if (mention.text && mention.text.content) {
              extractedTerms.push(mention.text.content.toLowerCase())
            }
          }
        }
      }
    }
    
    if (sentimentResponse.ok) {
      const sentimentData = await sentimentResponse.json()
      const documentSentiment = sentimentData.documentSentiment
      if (documentSentiment) {
        if (documentSentiment.score > 0.25) sentiment = 'positive'
        else if (documentSentiment.score < -0.25) sentiment = 'negative'
        else sentiment = 'neutral'
      }
    }
    
    if (classifyResponse.ok) {
      const classifyData = await classifyResponse.json()
      const categoryData = classifyData.categories || []
      
      for (const category of categoryData) {
        if (category.name) {
          categories.push(category.name)
        }
        if (category.categories) {
          for (const subCategory of category.categories) {
            if (subCategory.name) {
              categories.push(subCategory.name)
            }
          }
        }
      }
    }
    
    return { 
      entities: Array.from(new Set(extractedTerms)), 
      categories: Array.from(new Set(categories)),
      sentiment
    }
  } catch (error) {
    console.error('Error calling Google API:', error)
    return { entities: [], categories: [], sentiment: 'neutral' }
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ message: 'Using AI-powered tag generation with Hashy' })
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10 } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    console.log('[TAGS API] Generating tags with AI for:', { platform, description, count })
    
    // Try AI-powered tag generation first
    const aiTags = await generateTagsWithAI(description, platform, count)
    
    if (aiTags && aiTags.length > 0) {
      console.log('[TAGS API] AI-generated tags:', aiTags)
      return NextResponse.json({
        tags: aiTags.slice(0, count),
        platform,
        count: aiTags.slice(0, count).length,
        algorithm: 'ai',
        generatedAt: new Date().toISOString()
      })
    }
    
    // Fallback to Hashy if AI fails
    console.log('[TAGS API] AI unavailable, falling back to Hashy')
    const googleData = await extractEntitiesWithGoogle(description)
    const hashyResult = await hashy.generateTags('', description, platform, googleData)
    
    return NextResponse.json({
      tags: hashyResult.generatedTags.slice(0, count),
      platform,
      count: hashyResult.generatedTags.slice(0, count).length,
      detectedGames: hashyResult.detectedGames.map(g => g.name),
      detectedPlatform: hashyResult.detectedPlatform?.name || null,
      contextualTags: hashyResult.contextualTags,
      algorithm: 'hashy',
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating tags:', error)
    return NextResponse.json({ error: 'Failed to generate tags' }, { status: 500 })
  }
}
