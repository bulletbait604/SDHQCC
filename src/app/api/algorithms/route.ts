import { NextResponse } from 'next/server'

const platforms = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube-shorts', name: 'YouTube Shorts' },
  { id: 'youtube-long', name: 'YouTube Long' },
  { id: 'facebook-reels', name: 'Facebook Reels' }
]

// GitHub configuration
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username'
const GITHUB_REPO = process.env.GITHUB_REPO || 'hashy-tag-databases'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

async function readData() {
  // Try to read from GitHub first
  if (GITHUB_TOKEN) {
    try {
      const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      if (response.ok) {
        const fileData = await response.json()
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('Error reading from GitHub:', error)
    }
  }
  
  // Fallback to local file
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { data: {}, lastUpdated: null }
  }
}

async function writeData(data: any) {
  // Try to write to GitHub first
  if (GITHUB_TOKEN) {
    try {
      // Get current file SHA
      const getFileUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      const fileResponse = await fetch(getFileUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      let fileSha = null
      if (fileResponse.ok) {
        const fileData = await fileResponse.json()
        fileSha = fileData.sha
      }

      // Upload to GitHub
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
      const putUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-data.json?ref=${GITHUB_BRANCH}`
      
      const putBody = {
        message: `Update algorithm data - ${new Date().toISOString()}`,
        content: content,
        sha: fileSha
      }

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      })

      if (!putResponse.ok) {
        throw new Error(`Failed to save to GitHub: ${putResponse.status}`)
      }
      
      console.log('Successfully saved algorithm data to GitHub')
      return
    } catch (error) {
      console.error('Error writing to GitHub:', error)
    }
  }
  
  // Fallback to local file
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing data locally:', error)
  }
}

async function researchAlgorithm(platform: string, apiKey: string) {
  const modelName = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.3-70B-Instruct'
  const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`
  
  try {
    console.log(`Calling Hugging Face API for algorithm research: ${apiUrl}`)
  
    const prompt = `Research the current ${platform} algorithm and provide the following information in JSON format:
{
  "keyChanges": "Summary of key changes in how the algorithm works",
  "editingTips": "Tips for editing content for ${platform}",
  "postingTips": "Tips for when to post and posting frequency",
  "titleTips": "Tips for creating effective titles",
  "descriptionTips": "Tips for writing descriptions",
  "summaries": [
    "First key insight specific to ${platform} - max 6 words",
    "Second insight about ${platform} algorithm - max 6 words",
    "Third tip for ${platform} growth - max 6 words",
    "Fourth strategy for ${platform} - max 6 words"
  ]
}

Focus on recent changes and best practices as of 2026. Be specific and actionable. The summaries should be punchy, platform-specific takeaways that make users want to click Read More.`
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout for Hugging Face
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.7,
          return_full_text: false
        }
      })
    })
    
    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hugging Face error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || data.output || data.text || JSON.stringify(data)
    
    if (!content) {
      throw new Error('No content in Hugging Face response')
    }
    
    return JSON.parse(content || '{}')
  } catch (error) {
    console.error(`Hugging Face API failed for ${platform}:`, error)
    return null
  }
}

// Placeholder data to show until AI research completes
const placeholderData = {
  'tiktok': {
    keyChanges: 'TikTok algorithm prioritizes watch time and engagement. Content that keeps users watching longer gets promoted. The algorithm considers likes, comments, shares, and video completion rates.',
    editingTips: 'Use trending sounds, fast cuts, and on-screen text. Hook viewers in the first 3 seconds. Keep videos under 60 seconds for best performance. Add captions for accessibility.',
    postingTips: 'Post consistently, 3-5 times a day during peak hours (7-9 AM, 12-2 PM, 5-7 PM). Test different times to find when your audience is most active.',
    titleTips: 'Use engaging questions or strong calls to action. Keep captions concise but descriptive. Use relevant hashtags (3-5) in your niche.',
    descriptionTips: 'Include relevant hashtags, ask questions to encourage comments, and use emojis strategically. Add a call-to-action to boost engagement.',
    summaries: [
      'Trending sounds boost reach',
      '3-second hooks matter most',
      'Post 3-5x daily for growth',
      'Watch time drives promotion'
    ]
  },
  'instagram': {
    keyChanges: 'Instagram algorithm favors engagement, interests, and timeliness. Reels are currently prioritized in the feed. The algorithm considers likes, comments, saves, shares, and time spent on posts.',
    editingTips: 'High-quality visuals are essential. Use trending audio for Reels. Create diverse content formats (carousels, Reels, Stories). Use text overlays for accessibility.',
    postingTips: 'Post during optimal times (11 AM-1 PM, 7-9 PM). Use all features including Reels, Stories, and Lives. Consistency is key - aim for daily posts.',
    titleTips: 'Use strong hooks, emojis, and clear value propositions. Keep feed captions short but informative. Reels can have longer, more detailed captions.',
    descriptionTips: 'Use relevant hashtags (5-10), include call-to-actions, and ask engaging questions. Utilize keywords for search optimization.',
    summaries: [
      'Reels get priority in feed',
      'Saves matter more than likes',
      'Daily posts build momentum',
      'Trending audio increases reach'
    ]
  },
  'youtube-shorts': {
    keyChanges: 'YouTube Shorts algorithm focuses on watch time, loop rate, and engagement within the Shorts feed. Shorts that get rewatched perform better. The algorithm considers views, likes, comments, and shares.',
    editingTips: 'Use vertical video format (9:16). Fast pacing with captivating hooks in the first 3 seconds. Use YouTube Shorts features like text and stickers.',
    postingTips: 'Post daily, especially during prime mobile usage hours (6-10 AM, 6-10 PM). Consistency helps build momentum with the algorithm.',
    titleTips: 'Create short, descriptive, keyword-rich titles. Include #Shorts in your title or description for better discoverability.',
    descriptionTips: 'Write brief descriptions with relevant hashtags. Link to related long-form content to drive traffic to your main videos.',
    summaries: [
      'Vertical 9:16 format required',
      'Loop rate drives promotion',
      'Daily uploads build momentum',
      'Link to long-form content'
    ]
  },
  'youtube-long': {
    keyChanges: 'YouTube long-form algorithm prioritizes watch time, audience retention, and personalized recommendations. Videos that keep viewers watching longer get recommended more.',
    editingTips: 'Focus on high-quality production with clear audio. Use engaging storytelling and strong intros/outros. Add chapters for longer videos to improve navigation.',
    postingTips: 'Maintain a consistent schedule. Optimize for SEO with relevant keywords. Promote across other platforms. Analyze audience retention data regularly.',
    titleTips: 'Create compelling, keyword-rich titles that create curiosity or clearly state value. Your thumbnail is equally important for CTR.',
    descriptionTips: 'Write detailed descriptions with keywords, timestamps, links to resources, and social media. Encourage comments and engagement.',
    summaries: [
      'Watch time is king here',
      'Thumbnails affect CTR heavily',
      'Consistent schedule builds subs',
      'Chapters improve retention'
    ]
  },
  'facebook-reels': {
    keyChanges: 'Facebook Reels algorithm emphasizes entertainment, discovery, and creator consistency. Similar to Instagram Reels. Content that sparks conversation and sharing performs better.',
    editingTips: 'Use vertical video format with trending audio. Create engaging visuals with text overlays. Keep content concise and entertaining.',
    postingTips: 'Post regularly during peak Facebook usage (9-11 AM, 1-3 PM). Cross-post from Instagram Reels for efficiency. Test different content types.',
    titleTips: 'Write catchy, benefit-driven titles. Use emojis and clear calls to action. Make it clear what value viewers will get.',
    descriptionTips: 'Include relevant hashtags, ask engaging questions, and add links to other content or products when appropriate.',
    summaries: [
      'Entertainment value is priority',
      'Cross-post from Instagram',
      'Comments drive more reach',
      'Peak times: 9-11 AM, 1-3 PM'
    ]
  }
}

export async function GET() {
  const storedData = await readData()
  
  // If no stored data exists, return placeholder data
  if (!storedData.lastUpdated || Object.keys(storedData.data).length === 0) {
    return NextResponse.json({
      data: placeholderData,
      lastUpdated: new Date().toISOString()
    })
  }
  
  return NextResponse.json(storedData)
}

export async function POST() {
  const apiKey = process.env.HUGGINGFACE_TOKEN || process.env.RAPID_API_UNLIMITED_GPT || process.env.RAPIDAPI || process.env.RAPID_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured. Please set HUGGINGFACE_TOKEN, RAPIDAPI, RAPID_API_KEY, or RAPID_API_UNLIMITED_GPT' }, { status: 500 })
  }
  
  console.log('Using Hugging Face for algorithm research')
  
  const data: any = { data: {} }

  for (const platform of platforms) {
    const result = await researchAlgorithm(platform.name, apiKey)
    if (result) {
      data.data[platform.id] = result
    }
  }

  data.lastUpdated = new Date().toISOString()
  data.provider = 'huggingface'
  await writeData(data)

  return NextResponse.json(data)
}
