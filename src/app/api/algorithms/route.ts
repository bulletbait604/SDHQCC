import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const platforms = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube-shorts', name: 'YouTube Shorts' },
  { id: 'youtube-long', name: 'YouTube Long' },
  { id: 'facebook-reels', name: 'Facebook Reels' }
]

// Simple file-based storage (in production, use a proper database)
const DATA_FILE = './algorithm-data.json'

async function readData() {
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
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing data:', error)
  }
}

async function researchAlgorithm(platform: string, apiKey: string) {
  const openai = new OpenAI({ apiKey })
  
  const prompt = `Research the current ${platform} algorithm and provide the following information in JSON format:
{
  "keyChanges": "Summary of key changes in how the algorithm works",
  "editingTips": "Tips for editing content for ${platform}",
  "postingTips": "Tips for when to post and posting frequency",
  "titleTips": "Tips for creating effective titles",
  "descriptionTips": "Tips for writing descriptions"
}

Focus on recent changes and best practices as of 2026. Be specific and actionable.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert in social media algorithms and content optimization. Provide specific, actionable advice based on current best practices.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0].message.content
    return JSON.parse(content || '{}')
  } catch (error) {
    console.error(`Error researching ${platform}:`, error)
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
    descriptionTips: 'Include relevant hashtags, ask questions to encourage comments, and use emojis strategically. Add a call-to-action to boost engagement.'
  },
  'instagram': {
    keyChanges: 'Instagram algorithm favors engagement, interests, and timeliness. Reels are currently prioritized in the feed. The algorithm considers likes, comments, saves, shares, and time spent on posts.',
    editingTips: 'High-quality visuals are essential. Use trending audio for Reels. Create diverse content formats (carousels, Reels, Stories). Use text overlays for accessibility.',
    postingTips: 'Post during optimal times (11 AM-1 PM, 7-9 PM). Use all features including Reels, Stories, and Lives. Consistency is key - aim for daily posts.',
    titleTips: 'Use strong hooks, emojis, and clear value propositions. Keep feed captions short but informative. Reels can have longer, more detailed captions.',
    descriptionTips: 'Use relevant hashtags (5-10), include call-to-actions, and ask engaging questions. Utilize keywords for search optimization.'
  },
  'youtube-shorts': {
    keyChanges: 'YouTube Shorts algorithm focuses on watch time, loop rate, and engagement within the Shorts feed. Shorts that get rewatched perform better. The algorithm considers views, likes, comments, and shares.',
    editingTips: 'Use vertical video format (9:16). Fast pacing with captivating hooks in the first 3 seconds. Use YouTube Shorts features like text and stickers.',
    postingTips: 'Post daily, especially during prime mobile usage hours (6-10 AM, 6-10 PM). Consistency helps build momentum with the algorithm.',
    titleTips: 'Create short, descriptive, keyword-rich titles. Include #Shorts in your title or description for better discoverability.',
    descriptionTips: 'Write brief descriptions with relevant hashtags. Link to related long-form content to drive traffic to your main videos.'
  },
  'youtube-long': {
    keyChanges: 'YouTube long-form algorithm prioritizes watch time, audience retention, and personalized recommendations. Videos that keep viewers watching longer get recommended more.',
    editingTips: 'Focus on high-quality production with clear audio. Use engaging storytelling and strong intros/outros. Add chapters for longer videos to improve navigation.',
    postingTips: 'Maintain a consistent schedule. Optimize for SEO with relevant keywords. Promote across other platforms. Analyze audience retention data regularly.',
    titleTips: 'Create compelling, keyword-rich titles that create curiosity or clearly state value. Your thumbnail is equally important for CTR.',
    descriptionTips: 'Write detailed descriptions with keywords, timestamps, links to resources, and social media. Encourage comments and engagement.'
  },
  'facebook-reels': {
    keyChanges: 'Facebook Reels algorithm emphasizes entertainment, discovery, and creator consistency. Similar to Instagram Reels. Content that sparks conversation and sharing performs better.',
    editingTips: 'Use vertical video format with trending audio. Create engaging visuals with text overlays. Keep content concise and entertaining.',
    postingTips: 'Post regularly during peak Facebook usage (9-11 AM, 1-3 PM). Cross-post from Instagram Reels for efficiency. Test different content types.',
    titleTips: 'Write catchy, benefit-driven titles. Use emojis and clear calls to action. Make it clear what value viewers will get.',
    descriptionTips: 'Include relevant hashtags, ask engaging questions, and add links to other content or products when appropriate.'
  }
}

export async function GET() {
  const storedData = await readData()
  
  console.log('[API] readData returned:', JSON.stringify(storedData).substring(0, 200))
  
  // If no stored data exists, return placeholder data
  if (!storedData.lastUpdated || Object.keys(storedData.data).length === 0) {
    console.log('[API] Returning placeholder data')
    return NextResponse.json({
      data: placeholderData,
      lastUpdated: new Date().toISOString()
    })
  }
  
  console.log('[API] Returning stored data')
  return NextResponse.json(storedData)
}

export async function POST() {
  const openaiKey = process.env.OPENAI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!openaiKey && !deepseekKey) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 })
  }

  const apiKey = openaiKey || deepseekKey
  const data: any = { data: {} }

  for (const platform of platforms) {
    console.log(`Researching ${platform.name}...`)
    const result = await researchAlgorithm(platform.name, apiKey!)
    if (result) {
      data.data[platform.id] = result
    }
  }

  data.lastUpdated = new Date().toISOString()
  await writeData(data)

  return NextResponse.json(data)
}
