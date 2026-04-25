import { NextResponse } from 'next/server'
import { hashy } from '../../../../lib/hashy/hashy-algorithm'

// Google Cloud Natural Language API integration for entity extraction
async function extractEntitiesWithGoogle(description: string): Promise<{ entities: string[], categories: string[], sentiment: string }> {
  const apiKey = process.env.GOOGLE_API_KEY
  
  if (!apiKey) {
    return { entities: [], categories: [], sentiment: 'neutral' }
  }
  
  try {
    // Analyze entities
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
    
    // Analyze sentiment
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
    
    // Analyze categories
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
    
    // Process entities
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
    
    // Process sentiment
    if (sentimentResponse.ok) {
      const sentimentData = await sentimentResponse.json()
      const documentSentiment = sentimentData.documentSentiment
      if (documentSentiment) {
        if (documentSentiment.score > 0.25) sentiment = 'positive'
        else if (documentSentiment.score < -0.25) sentiment = 'negative'
        else sentiment = 'neutral'
      }
    }
    
    // Process categories
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
  return NextResponse.json({ message: 'Using Hashy cloud databases via GitHub' })
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10 } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    // Extract entities using Google API for enhanced Hashy analytics
    const googleData = await extractEntitiesWithGoogle(description)
    
    console.log('[TAGS API] Calling Hashy with:', { platform, description, count })
    console.log('[TAGS API] Google data:', googleData)
    
    const hashyResult = await hashy.generateTags('', description, platform, googleData)
    
    console.log('[TAGS API] Hashy result:', hashyResult)
    
    return NextResponse.json({
      tags: hashyResult.generatedTags.slice(0, count),
      platform,
      count: hashyResult.generatedTags.slice(0, count).length,
      detectedGames: hashyResult.detectedGames.map(g => g.name),
      detectedPlatform: hashyResult.detectedPlatform?.name || null,
      contextualTags: hashyResult.contextualTags,
      googleEntities: hashyResult.googleEntities,
      googleCategories: hashyResult.googleCategories,
      googleSentiment: hashyResult.googleSentiment,
      algorithm: 'hashy',
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating tags:', error)
    return NextResponse.json({ error: 'Failed to generate tags' }, { status: 500 })
  }
}
