# Algorithms Explained Page - Environment Variables

To enable the automatic weekly algorithm research feature, you need to add the following environment variables to your `.env.local` file:

## Required Environment Variables

### Google AI Studio / Gemini API (Recommended)
```
GEMINI_API=your_google_ai_studio_key
```
- Get your API key from: https://aistudio.google.com/app/apikey
- Used for researching social media algorithms

### DeepSeek API (Legacy Optional Fallback)
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```
- Get your API key from: https://platform.deepseek.com/
- Fallback only if Gemini is unavailable

### Base URL (Optional - for cron job)
```
NEXT_PUBLIC_BASE_URL=your_production_url_here
```
- Example: `https://your-domain.com`
- Default: `http://localhost:3000`
- Used by the cron job endpoint to call the main API

## Setup Instructions

1. Open your `.env.local` file in the root of your project
2. Add `GEMINI_API` (recommended), or a legacy fallback key if needed
3. Add the base URL if deploying to production

## Cron Job Setup

To enable automatic weekly updates, set up a cron job to call:
```
POST https://your-domain.com/api/algorithms/update
```

### Using cron-job.org (Free option)
1. Go to https://cron-job.org/
2. Create an account
3. Add a new cron job:
   - URL: `https://your-domain.com/api/algorithms/update`
   - Method: POST
   - Schedule: Weekly (e.g., every Sunday at 2 AM)

### Using Vercel Cron Jobs (if deploying on Vercel)
Add to your `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/algorithms/update",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

## How It Works

1. The cron job calls `/api/algorithms/update` weekly
2. This endpoint triggers the main `/api/algorithms` POST endpoint
3. The AI provider researches current algorithms for:
   - TikTok
   - Instagram
   - YouTube Shorts
   - YouTube Long
   - Facebook Reels
4. Results are saved to `algorithm-data.json`
5. The frontend displays the data with an "Updates [date]" note

## Manual Update

To manually trigger an update, you can:
1. Call the API directly: `POST /api/algorithms`
2. Or use the update endpoint: `POST /api/algorithms/update`

## Data Storage

The algorithm data is stored in `algorithm-data.json` in the project root. In production, consider using a proper database for better scalability.
