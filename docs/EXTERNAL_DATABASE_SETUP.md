# External Database Setup for Hashy Tag Generator

## Current Database Sizes
- TikTok: 793 tags
- Instagram: 1,376 tags
- YouTube Shorts: 463 tags
- YouTube Long: 459 tags
- Facebook Reels: 462 tags

**Total: ~3,553 tags across 5 platforms**

## Why Use an External Database?

**Benefits:**
- No JSON file size limitations
- Faster queries with indexing
- Easy to update without redeploying
- Can scale to millions of tags
- Real-time updates possible
- Better performance for large datasets

**Recommended when:**
- You want 10,000+ tags per platform
- You need real-time tag updates
- You want to track tag performance
- You need complex queries (e.g., trending, banned tags)

## Option 1: MongoDB (Recommended)

### Setup Instructions

1. **Create a free MongoDB Atlas account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free tier (512MB storage)

2. **Create a cluster**
   - Create a new cluster (free M0 tier)
   - Choose a region close to your users
   - Wait for cluster to be created

3. **Create database and collections**
   ```javascript
   // In MongoDB Atlas Shell or Compass
   use hashy_tags
   
   // Create collections for each platform
   db.createCollection('tiktok_tags')
   db.createCollection('instagram_tags')
   db.createCollection('youtube_shorts_tags')
   db.createCollection('youtube_long_tags')
   db.createCollection('facebook_reels_tags')
   ```

4. **Import existing tags**
   ```bash
   # Export current JSON to CSV format first
   # Then import using mongoimport
   mongoimport --uri "mongodb+srv://<username>:<password>@cluster.mongodb.net/hashy_tags" \
     --collection tiktok_tags \
     --type json \
     --file tags-tiktok.json \
     --jsonArray
   ```

5. **Add indexes for performance**
   ```javascript
   db.tiktok_tags.createIndex({ tag: 1 })
   db.tiktok_tags.createIndex({ popularity: -1 })
   db.tiktok_tags.createIndex({ category: 1 })
   ```

6. **Get connection string**
   - In Atlas: Database → Connect → Connect your application
   - Copy the connection string
   - Add to your `.env` file:
     ```
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hashy_tags
     ```

### Update Hashy to Use MongoDB

Install MongoDB driver:
```bash
npm install mongodb
```

Update `lib/hashy/hashy-algorithm.ts`:
```typescript
import { MongoClient } from 'mongodb';

export class HashyAlgorithm {
  private client: MongoClient;
  private db: any;

  constructor() {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      this.client = new MongoClient(uri);
      this.client.connect();
      this.db = this.client.db('hashy_tags');
    }
  }

  private async getTagsFromMongo(platform: string): Promise<string[]> {
    if (!this.db) return [];
    
    const collectionName = this.getCollectionName(platform);
    const result = await this.db.collection(collectionName)
      .find({})
      .sort({ popularity: -1 })
      .limit(1000)
      .toArray();
    
    return result.map((item: any) => item.tag);
  }

  private getCollectionName(platform: string): string {
    const mapping: Record<string, string> = {
      'TikTok': 'tiktok_tags',
      'Instagram': 'instagram_tags',
      'YouTube Shorts': 'youtube_shorts_tags',
      'YouTube Long': 'youtube_long_tags',
      'Facebook Reels': 'facebook_reels_tags'
    };
    return mapping[platform] || 'generic_tags';
  }
}
```

## Option 2: PostgreSQL

### Setup Instructions

1. **Create a free PostgreSQL database**
   - Supabase (free tier): https://supabase.com
   - Neon (free tier): https://neon.tech
   - Railway (free tier): https://railway.app

2. **Create tables**
   ```sql
   CREATE TABLE tags (
     id SERIAL PRIMARY KEY,
     tag VARCHAR(255) NOT NULL,
     platform VARCHAR(50) NOT NULL,
     popularity INTEGER DEFAULT 0,
     category VARCHAR(100),
     is_banned BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE INDEX idx_tags_platform ON tags(platform);
   CREATE INDEX idx_tags_popularity ON tags(popularity DESC);
   CREATE INDEX idx_tags_tag ON tags(tag);
   ```

3. **Import data**
   ```sql
   -- Use pgAdmin or psql to import
   COPY tags(tag, platform, popularity, category)
   FROM '/path/to/tags.csv'
   DELIMITER ','
   CSV HEADER;
   ```

4. **Add to .env**
   ```
   DATABASE_URL=postgresql://user:password@host:5432/hashy_tags
   ```

### Update Hashy to Use PostgreSQL

Install PostgreSQL client:
```bash
npm install pg
```

Update `lib/hashy/hashy-algorithm.ts`:
```typescript
import { Pool } from 'pg';

export class HashyAlgorithm {
  private pool: Pool;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
    }
  }

  private async getTagsFromPostgres(platform: string): Promise<string[]> {
    if (!this.pool) return [];
    
    const result = await this.pool.query(
      'SELECT tag FROM tags WHERE platform = $1 AND is_banned = FALSE ORDER BY popularity DESC LIMIT 1000',
      [platform]
    );
    
    return result.rows.map(row => row.tag);
  }
}
```

## Option 3: Simple REST API (Easiest)

### Setup Instructions

1. **Create a simple API endpoint**
   - Use Vercel, Netlify, or Railway
   - Deploy a simple Express/Next.js API

2. **API structure**
   ```
   GET /api/tags/:platform
   Response: { tags: string[], count: number }
   ```

3. **Example API code (Next.js)**
   ```typescript
   // app/api/tags/[platform]/route.ts
   import { NextResponse } from 'next/server';
   
   export async function GET(request: Request, { params }: { params: { platform: string } }) {
     const platform = params.platform;
     
     // Load from database (could be MongoDB, PostgreSQL, or even JSON)
     const tags = await loadTagsForPlatform(platform);
     
     return NextResponse.json({ tags, count: tags.length });
   }
   ```

4. **Update Hashy to fetch from API**
   ```typescript
   private async getTagsFromAPI(platform: string): Promise<string[]> {
     const response = await fetch(`https://your-api.com/api/tags/${platform}`);
     const data = await response.json();
     return data.tags;
   }
   ```

## Option 4: Firebase Realtime Database

### Setup Instructions

1. **Create Firebase project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Realtime Database

2. **Import data**
   ```javascript
   // In Firebase Console
   // Import JSON files directly
   ```

3. **Add to .env**
   ```
   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   ```

### Update Hashy to Use Firebase

Install Firebase SDK:
```bash
npm install firebase
```

Update `lib/hashy/hashy-algorithm.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export class HashyAlgorithm {
  private async getTagsFromFirebase(platform: string): Promise<string[]> {
    const platformRef = ref(database, `tags/${platform}`);
    const snapshot = await get(platformRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return data.tags || [];
    }
    
    return [];
  }
}
```

## Recommendation

**For your use case, I recommend MongoDB Atlas because:**
- Free tier is generous (512MB)
- Easy to set up
- Excellent performance for tag queries
- Built-in indexing
- Easy to scale later
- Good TypeScript support

**Current database sizes are adequate for now** (3,553 total tags), but if you want to scale to 10,000+ tags per platform, an external database is the way to go.

## Migration Steps

1. Choose your database option (MongoDB recommended)
2. Set up the database
3. Import existing JSON data
4. Update Hashy algorithm to fetch from database
5. Test thoroughly
6. Deploy changes

Would you like me to implement one of these options for you?
