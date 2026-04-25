# MongoDB Atlas Setup Guide for Hashy Tag Generator

## Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" or "Sign Up"
3. Choose "Sign up with Email" or use Google/GitHub
4. Fill in your details:
   - Email address
   - Password
   - Company name (optional)
5. Verify your email address
6. Select "Build a Database" or "Create Free Cluster"

## Step 2: Create a Free Cluster

1. After signing in, you'll see the "Build a Database" screen
2. Select **M0 Free** tier (512MB storage, shared RAM)
3. Choose a cloud provider:
   - AWS (recommended)
   - Google Cloud
   - Azure
4. Select a region closest to your users:
   - For US East: `us-east-1`
   - For US West: `us-west-2`
   - For Europe: `eu-central-1`
5. Enter a cluster name (e.g., `hashy-cluster`)
6. Click "Create"
7. Wait 2-3 minutes for cluster to be created (you'll see a green checkmark when ready)

## Step 3: Create Database User

1. Once cluster is ready, click "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose authentication method:
   - **Password** (recommended for simplicity)
4. Fill in user details:
   - Username: `hashy_user` (or your preferred name)
   - Password: Generate a strong password (save this!)
5. For database user privilege, select:
   - **Read and write to any database**
6. Click "Create User"

## Step 4: Whitelist IP Address

1. Click "Network Access" in left sidebar
2. Click "Add IP Address"
3. Choose one of these options:
   - **Allow Access from Anywhere** (0.0.0.0/0) - Easiest for development
   - **Add Your Current IP Address** - More secure
4. Click "Confirm"
5. Add comment like "Hashy API access"

## Step 5: Get Connection String

1. Click "Database" in left sidebar
2. Click "Connect" button on your cluster
3. Choose "Connect your application"
4. Select driver: **Node.js**
5. Select version: **6.0 or later**
6. Copy the connection string (it looks like):
   ```
   mongodb+srv://hashy_user:<password>@hashy-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with your actual password from Step 3

## Step 6: Add Connection String to .env

1. Open your project's `.env.local` file (create if doesn't exist)
2. Add this line:
   ```
   MONGODB_URI=mongodb+srv://hashy_user:YOUR_PASSWORD@hashy-cluster.xxxxx.mongodb.net/hashy_tags?retryWrites=true&w=majority
   ```
3. Replace `YOUR_PASSWORD` with your actual password
4. Replace the cluster URL with your actual connection string
5. Save the file

## Step 7: Install MongoDB Driver

1. Open terminal in your project directory
2. Run:
   ```bash
   npm install mongodb
   ```
3. Wait for installation to complete

## Step 8: Create Database and Collections

You can do this via MongoDB Atlas UI or programmatically. Let's do it via UI first:

### Option A: Via MongoDB Atlas UI

1. Click "Database" in left sidebar
2. Click "Browse Collections" on your cluster
3. Click "Add My Own Data"
4. Enter database name: `hashy_tags`
5. Click "Create"
6. Click "Add Collection" button
7. Create these collections:
   - `tiktok_tags`
   - `instagram_tags`
   - `youtube_shorts_tags`
   - `youtube_long_tags`
   - `facebook_reels_tags`

### Option B: Programmatically (Recommended)

Create a temporary script to set up database:

1. Create file `scripts/setup-mongodb.js`:
   ```javascript
   const { MongoClient } = require('mongodb');
   
   const uri = process.env.MONGODB_URI;
   const client = new MongoClient(uri);
   
   async function setupDatabase() {
     try {
       await client.connect();
       console.log('Connected to MongoDB');
       
       const db = client.db('hashy_tags');
       
       // Create collections
       await db.createCollection('tiktok_tags');
       await db.createCollection('instagram_tags');
       await db.createCollection('youtube_shorts_tags');
       await db.createCollection('youtube_long_tags');
       await db.createCollection('facebook_reels_tags');
       
       console.log('Collections created successfully');
       
       // Create indexes for performance
       await db.collection('tiktok_tags').createIndex({ tag: 1 });
       await db.collection('tiktok_tags').createIndex({ popularity: -1 });
       await db.collection('instagram_tags').createIndex({ tag: 1 });
       await db.collection('instagram_tags').createIndex({ popularity: -1 });
       await db.collection('youtube_shorts_tags').createIndex({ tag: 1 });
       await db.collection('youtube_shorts_tags').createIndex({ popularity: -1 });
       await db.collection('youtube_long_tags').createIndex({ tag: 1 });
       await db.collection('youtube_long_tags').createIndex({ popularity: -1 });
       await db.collection('facebook_reels_tags').createIndex({ tag: 1 });
       await db.collection('facebook_reels_tags').createIndex({ popularity: -1 });
       
       console.log('Indexes created successfully');
       
     } catch (error) {
       console.error('Error:', error);
     } finally {
       await client.close();
     }
   }
   
   setupDatabase();
   ```

2. Run the script:
   ```bash
   node scripts/setup-mongodb.js
   ```

## Step 9: Import Existing Tag Data

### Option A: Using MongoDB Atlas Import Tool

1. Click "Database" → "Browse Collections"
2. Click "Add Data" → "Import JSON or CSV"
3. Select collection (e.g., `tiktok_tags`)
4. Upload your JSON file
5. Repeat for each platform

### Option B: Using mongoimport CLI

1. Download MongoDB Tools from: https://www.mongodb.com/try/download/tools
2. Extract and add to PATH
3. Convert your JSON files to array format if needed:

Create `scripts/convert-tags.js`:
```javascript
const fs = require('fs');

const platforms = [
  { file: 'lib/hashy/tags-tiktok.json', collection: 'tiktok_tags' },
  { file: 'lib/hashy/tags-instagram.json', collection: 'instagram_tags' },
  { file: 'lib/hashy/tags-youtubeshorts.json', collection: 'youtube_shorts_tags' },
  { file: 'lib/hashy/tags-youtubelong.json', collection: 'youtube_long_tags' },
  { file: 'lib/hashy/tags-facebookreels.json', collection: 'facebook_reels_tags' }
];

platforms.forEach(({ file, collection }) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  
  // Convert to array format for import
  const documents = data.tags.map((tag, index) => ({
    tag,
    popularity: 100 - index, // Simple popularity based on order
    platform: data.platform,
    createdAt: new Date().toISOString()
  }));
  
  fs.writeFileSync(`temp/${collection}.json`, JSON.stringify(documents, null, 2));
  console.log(`Converted ${file} to temp/${collection}.json`);
});
```

4. Run conversion:
   ```bash
   mkdir temp
   node scripts/convert-tags.js
   ```

5. Import each file:
   ```bash
   mongoimport --uri "MONGODB_URI" \
     --db hashy_tags \
     --collection tiktok_tags \
     --file temp/tiktok_tags.json \
     --jsonArray
   
   mongoimport --uri "MONGODB_URI" \
     --db hashy_tags \
     --collection instagram_tags \
     --file temp/instagram_tags.json \
     --jsonArray
   
   # Repeat for other collections...
   ```

### Option C: Programmatically Import (Recommended)

Create `scripts/import-tags.js`:
```javascript
const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function importTags() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('hashy_tags');
    
    const platforms = [
      { file: 'lib/hashy/tags-tiktok.json', collection: 'tiktok_tags' },
      { file: 'lib/hashy/tags-instagram.json', collection: 'instagram_tags' },
      { file: 'lib/hashy/tags-youtubeshorts.json', collection: 'youtube_shorts_tags' },
      { file: 'lib/hashy/tags-youtubelong.json', collection: 'youtube_long_tags' },
      { file: 'lib/hashy/tags-facebookreels.json', collection: 'facebook_reels_tags' }
    ];
    
    for (const { file, collection } of platforms) {
      console.log(`Importing ${file} to ${collection}...`);
      
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      
      const documents = data.tags.map((tag, index) => ({
        tag,
        popularity: 100 - index,
        platform: data.platform,
        createdAt: new Date().toISOString()
      }));
      
      await db.collection(collection).insertMany(documents);
      console.log(`Imported ${documents.length} tags to ${collection}`);
    }
    
    console.log('All tags imported successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

importTags();
```

Run:
```bash
node scripts/import-tags.js
```

## Step 10: Update Hashy Algorithm to Use MongoDB

1. Open `lib/hashy/hashy-algorithm.ts`
2. Replace the file content with:

```typescript
/**
 * Hashy Algorithm - In-house Tag Generator
 * 
 * This algorithm replaces the Google API-based tag generation system
 * by using local databases for games, platforms, and platform-specific tags.
 */

import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';

// Database interfaces
interface Game {
  name: string;
  aliases: string[];
  developer: string;
  genre: string[];
  platforms: string[];
  popularity: number;
  tags: string[];
}

interface Platform {
  name: string;
  category: string;
  type: string;
  urlPattern: string;
  keywords: string[];
  aliases: string[];
  popularity: number;
}

interface TagDatabase {
  version: string;
  lastUpdated: string;
  platform: string;
  count: number;
  tags: string[];
}

// Hashy result interface
interface HashyResult {
  detectedGames: Game[];
  detectedPlatform: Platform | null;
  generatedTags: string[];
  contextualTags: string[];
  googleEntities?: string[];
  googleCategories?: string[];
  googleSentiment?: string;
  debug: {
    keywords: string[];
    gameMatches: string[];
    platformMatches: string[];
  };
}

/**
 * Hashy Algorithm Class
 */
export class HashyAlgorithm {
  private gamesDatabase: Game[] = [];
  private platformsDatabase: Platform[] = [];
  private tagDatabases: Map<string, TagDatabase> = new Map();
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private useMongoDB: boolean = false;

  constructor() {
    this.initializeMongoDB();
    this.loadDatabases();
  }

  private async initializeMongoDB(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI;
    
    if (mongoUri) {
      try {
        this.mongoClient = new MongoClient(mongoUri);
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db('hashy_tags');
        this.useMongoDB = true;
        console.log('Connected to MongoDB for tag databases');
      } catch (error) {
        console.error('Failed to connect to MongoDB, falling back to JSON files:', error);
        this.useMongoDB = false;
      }
    }
  }

  /**
   * Load all databases from JSON files
   */
  private loadDatabases(): void {
    try {
      const hashyDir = path.join(process.cwd(), 'lib', 'hashy');
      
      // Load games database
      const gamesPath = path.join(hashyDir, 'games-database.json');
      if (fs.existsSync(gamesPath)) {
        const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf-8'));
        this.gamesDatabase = gamesData.games || [];
      }

      // Load platforms database
      const platformsPath = path.join(hashyDir, 'platforms-database.json');
      if (fs.existsSync(platformsPath)) {
        const platformsData = JSON.parse(fs.readFileSync(platformsPath, 'utf-8'));
        this.platformsDatabase = platformsData.platforms || [];
      }

      // Load tag databases (only if not using MongoDB)
      if (!this.useMongoDB) {
        const tagFiles = [
          'tags-tiktok.json',
          'tags-instagram.json',
          'tags-youtubeshorts.json',
          'tags-youtubelong.json',
          'tags-facebookreels.json'
        ];

        for (const file of tagFiles) {
          try {
            const tagPath = path.join(hashyDir, file);
            if (fs.existsSync(tagPath)) {
              const tagData = JSON.parse(fs.readFileSync(tagPath, 'utf-8'));
              this.tagDatabases.set(tagData.platform, tagData);
            }
          } catch (error) {
            console.warn(`Failed to load tag database: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading Hashy databases:', error);
    }
  }

  /**
   * Get platform-specific tag database from MongoDB
   */
  private async getTagsFromMongoDB(platformName: string): Promise<string[]> {
    if (!this.mongoDb) return [];
    
    const collectionName = this.getMongoCollectionName(platformName);
    
    try {
      const result = await this.mongoDb.collection(collectionName)
        .find({})
        .sort({ popularity: -1 })
        .limit(1000)
        .toArray();
      
      return result.map((item: any) => item.tag);
    } catch (error) {
      console.error(`Error fetching tags from MongoDB for ${platformName}:`, error);
      return [];
    }
  }

  private getMongoCollectionName(platformName: string): string {
    const mapping: Record<string, string> = {
      'TikTok': 'tiktok_tags',
      'Instagram': 'instagram_tags',
      'YouTube Shorts': 'youtube_shorts_tags',
      'YouTube Long': 'youtube_long_tags',
      'Facebook Reels': 'facebook_reels_tags'
    };
    return mapping[platformName] || 'generic_tags';
  }

  /**
   * Extract keywords from user input (title and description)
   */
  private extractKeywords(title: string, description: string): string[] {
    const combinedText = `${title} ${description}`.toLowerCase();
    
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'down', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what',
      'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
      'as', 'if', 'because', 'until', 'while', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'under',
      'again', 'further', 'their', 'your', 'our', 'his', 'her', 'my'
    ]);

    // Split into words and filter
    const words = combinedText
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Remove duplicates
    return Array.from(new Set(words));
  }

  /**
   * Detect games from keywords
   */
  private detectGames(keywords: string[]): Game[] {
    const detectedGames: Game[] = [];

    for (const game of this.gamesDatabase) {
      let matchScore = 0;

      // Check game name
      if (keywords.some(k => game.name.toLowerCase().includes(k) || k.includes(game.name.toLowerCase()))) {
        matchScore += 10;
      }

      // Check aliases
      for (const alias of game.aliases) {
        if (keywords.some(k => alias.toLowerCase().includes(k) || k.includes(alias.toLowerCase()))) {
          matchScore += 5;
        }
      }

      // Check tags
      for (const tag of game.tags) {
        if (keywords.some(k => tag.toLowerCase().includes(k) || k.includes(tag.toLowerCase()))) {
          matchScore += 2;
        }
      }

      // Check genre
      for (const genre of game.genre) {
        if (keywords.some(k => genre.toLowerCase().includes(k) || k.includes(genre.toLowerCase()))) {
          matchScore += 3;
        }
      }

      // Add game if it has a decent match score
      if (matchScore >= 5) {
        detectedGames.push({ ...game, popularity: game.popularity + matchScore });
      }
    }

    // Sort by popularity (highest first)
    return detectedGames.sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  }

  /**
   * Detect platform from keywords and description
   */
  private detectPlatform(keywords: string[], description: string): Platform | null {
    const lowerDescription = description.toLowerCase();

    for (const platform of this.platformsDatabase) {
      let matchScore = 0;

      // Check URL pattern in description
      if (platform.urlPattern && lowerDescription.includes(platform.urlPattern)) {
        matchScore += 20;
      }

      // Check keywords
      for (const keyword of platform.keywords) {
        if (keywords.some(k => keyword.toLowerCase().includes(k) || k.includes(keyword.toLowerCase()))) {
          matchScore += 5;
        }
        if (lowerDescription.includes(keyword.toLowerCase())) {
          matchScore += 3;
        }
      }

      // Check aliases
      for (const alias of platform.aliases) {
        if (keywords.some(k => alias.toLowerCase().includes(k) || k.includes(alias.toLowerCase()))) {
          matchScore += 4;
        }
        if (lowerDescription.includes(alias.toLowerCase())) {
          matchScore += 2;
        }
      }

      // Check platform name
      if (keywords.some(k => platform.name.toLowerCase().includes(k) || k.includes(platform.name.toLowerCase()))) {
        matchScore += 5;
      }

      // Return platform if it has a good match
      if (matchScore >= 5) {
        return { ...platform, popularity: platform.popularity + matchScore };
      }
    }

    return null;
  }

  /**
   * Get platform-specific tag database
   */
  private async getTagDatabase(platformName: string): Promise<TagDatabase | null> {
    // If using MongoDB, fetch from there
    if (this.useMongoDB) {
      const tags = await this.getTagsFromMongoDB(platformName);
      if (tags.length > 0) {
        return {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          platform: platformName,
          count: tags.length,
          tags
        };
      }
    }
    
    // Fallback to JSON files
    const normalized = platformName.toLowerCase().replace(/\s+/g, '');
    
    // Try exact match first
    const entries = Array.from(this.tagDatabases.entries());
    for (const [key, value] of entries) {
      if (key.toLowerCase().replace(/\s+/g, '') === normalized) {
        return value;
      }
    }

    // Try partial match
    for (const [key, value] of entries) {
      if (normalized.includes(key.toLowerCase().replace(/\s+/g, '')) || 
          key.toLowerCase().replace(/\s+/g, '').includes(normalized)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Generate tags based on detected games, platform, and keywords
   */
  private async generateTagsInternal(
    detectedGames: Game[],
    detectedPlatform: Platform | null,
    keywords: string[],
    targetPlatform?: string
  ): Promise<{ generatedTags: string[], contextualTags: string[] }> {
    const generatedTags: string[] = [];
    const contextualTags: string[] = [];

    // Add game-specific tags
    for (const game of detectedGames) {
      generatedTags.push(...game.tags.slice(0, 10));
      contextualTags.push(game.name);
      contextualTags.push(...game.genre.slice(0, 3));
    }

    // Add platform-specific tags
    const platformToUse = targetPlatform || (detectedPlatform?.name || null);
    if (platformToUse) {
      const tagDb = await this.getTagDatabase(platformToUse);
      if (tagDb) {
        generatedTags.push(...tagDb.tags.slice(0, 20));
      }
    }

    // Add keyword-based tags
    for (const keyword of keywords) {
      if (keyword.length > 3) {
        generatedTags.push(keyword);
      }
    }

    // Remove duplicates and limit
    const uniqueGenerated = Array.from(new Set(generatedTags)).slice(0, 30);
    const uniqueContextual = Array.from(new Set(contextualTags)).slice(0, 10);

    return {
      generatedTags: uniqueGenerated,
      contextualTags: uniqueContextual
    };
  }

  /**
   * Main method to generate tags using Hashy algorithm
   */
  public async generateTags(
    title: string,
    description: string,
    targetPlatform?: string,
    googleData?: { entities: string[], categories: string[], sentiment: string }
  ): Promise<HashyResult> {
    // Ensure databases are loaded
    if (this.gamesDatabase.length === 0) {
      this.loadDatabases();
    }

    // Extract keywords
    const keywords = this.extractKeywords(title, description);

    // Add Google entities to keywords for better matching
    if (googleData && googleData.entities.length > 0) {
      for (const entity of googleData.entities) {
        if (!keywords.includes(entity.toLowerCase())) {
          keywords.push(entity.toLowerCase());
        }
      }
    }

    // Detect games
    const detectedGames = this.detectGames(keywords);

    // Detect platform
    const detectedPlatform = this.detectPlatform(keywords, description);

    // Generate tags
    const { generatedTags, contextualTags } = await this.generateTagsInternal(
      detectedGames,
      detectedPlatform,
      keywords,
      targetPlatform
    );

    // Boost tags that match Google entities
    if (googleData && googleData.entities.length > 0) {
      const boostedTags = generatedTags.map(tag => {
        const tagLower = tag.toLowerCase();
        let boostScore = 0;
        
        for (const entity of googleData.entities) {
          if (tagLower.includes(entity.toLowerCase()) || entity.toLowerCase().includes(tagLower)) {
            boostScore += 10;
          }
        }
        
        return { tag, boostScore };
      });
      
      // Sort by boost score
      boostedTags.sort((a, b) => b.boostScore - a.boostScore);
      
      return {
        detectedGames,
        detectedPlatform,
        generatedTags: boostedTags.map(bt => bt.tag),
        contextualTags,
        googleEntities: googleData.entities,
        googleCategories: googleData.categories,
        googleSentiment: googleData.sentiment,
        debug: {
          keywords,
          gameMatches: detectedGames.map(g => g.name),
          platformMatches: detectedPlatform ? [detectedPlatform.name] : []
        }
      };
    }

    return {
      detectedGames,
      detectedPlatform,
      generatedTags,
      contextualTags,
      googleEntities: googleData?.entities,
      googleCategories: googleData?.categories,
      googleSentiment: googleData?.sentiment,
      debug: {
        keywords,
        gameMatches: detectedGames.map(g => g.name),
        platformMatches: detectedPlatform ? [detectedPlatform.name] : []
      }
    };
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }
}

// Export singleton instance
export const hashy = new HashyAlgorithm();
```

## Step 11: Update API Route to Handle Async Hashy

Since Hashy now has async methods, update the API route:

1. Open `src/app/api/tags/route.ts`
2. Find the line where Hashy is called:
   ```typescript
   const hashyResult = hashy.generateTags('', description, platform, googleData)
   ```
3. Change to:
   ```typescript
   const hashyResult = await hashy.generateTags('', description, platform, googleData)
   ```

## Step 12: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test the tag generation API:
   ```bash
   curl -X POST http://localhost:3000/api/tags \
     -H "Content-Type: application/json" \
     -d '{
       "description": "gaming video about fortnite",
       "platform": "TikTok",
       "premium": false
     }'
   ```

3. Check console logs for:
   - "Connected to MongoDB for tag databases" (success)
   - Or fallback message if MongoDB fails

## Step 13: Verify Data in MongoDB

1. Go to MongoDB Atlas
2. Click "Database" → "Browse Collections"
3. Verify all collections have data:
   - tiktok_tags: ~793 documents
   - instagram_tags: ~1,376 documents
   - youtube_shorts_tags: ~463 documents
   - youtube_long_tags: ~459 documents
   - facebook_reels_tags: ~462 documents

## Troubleshooting

**Connection Error:**
- Verify MONGODB_URI in .env.local
- Check IP whitelist in Network Access
- Ensure username/password are correct

**Import Error:**
- Check JSON file format
- Ensure collections exist before importing
- Verify file paths are correct

**No Tags Returned:**
- Check collection names match mapping
- Verify data was imported successfully
- Check browser console for errors

**Performance Issues:**
- Ensure indexes are created
- Limit query results (already done in code)
- Consider caching frequently accessed tags

## Next Steps

After successful setup:
1. Add more tags to MongoDB (can scale to millions)
2. Implement tag performance tracking
3. Add real-time trending tag updates
4. Create admin panel for tag management
5. Add banned tag filtering in database

## Security Notes

- Never commit .env.local to git
- Use strong passwords for MongoDB
- Restrict IP whitelist in production
- Consider using MongoDB Atlas Data API for serverless
- Enable encryption at rest (enabled by default in Atlas)
