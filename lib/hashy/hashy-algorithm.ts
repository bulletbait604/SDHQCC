/**
 * Hashy Algorithm - In-house Tag Generator
 * 
 * This algorithm replaces the Google API-based tag generation system
 * by using cloud-based databases for games, platforms, and platform-specific tags.
 */

import fs from 'fs';
import path from 'path';

// GitHub configuration - set these in .env.local
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username';
const GITHUB_REPO = process.env.GITHUB_REPO || 'hashy-tag-databases';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const USE_CLOUD_DB = process.env.USE_CLOUD_DB === 'true';

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

interface AlgorithmInsights {
  keyChanges: string;
  editingTips: string;
  postingTips: string;
  titleTips: string;
  descriptionTips: string;
  summaries: string[];
}

interface HashyAlgorithmData {
  algorithmInsights: Record<string, AlgorithmInsights>;
  lastUpdated: string;
  provider: string;
  platforms: string[];
}

// Hashy result interface
interface HashyResult {
  detectedGames: Game[];
  detectedPlatform: Platform | null;
  generatedTags: string[];
  contextualTags: string[];
  algorithmTips?: string[];
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
  private algorithmInsights: HashyAlgorithmData | null = null;

  constructor() {
    // Don't await in constructor - loadDatabases is now async
    this.loadDatabases().catch(error => {
      console.error('Error loading databases:', error);
    });
  }

  /**
   * Fetch tag database from GitHub
   */
  private async fetchFromGitHub(filename: string): Promise<TagDatabase | null> {
    const url = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filename}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${filename} from GitHub: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`Error fetching ${filename} from GitHub:`, error);
      return null;
    }
  }

  /**
   * Load all databases from JSON files or GitHub
   */
  private async loadDatabases(): Promise<void> {
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

      // Load algorithm insights
      const algorithmPath = path.join(hashyDir, 'algorithm-insights.json');
      if (fs.existsSync(algorithmPath)) {
        const algorithmData = JSON.parse(fs.readFileSync(algorithmPath, 'utf-8'));
        this.algorithmInsights = algorithmData;
        console.log(`Loaded algorithm insights for ${algorithmData.platforms?.length || 0} platforms`);
      }

      // Load tag databases
      const tagFiles = [
        { file: 'tags-tiktok.json', platform: 'TikTok' },
        { file: 'tags-instagram.json', platform: 'Instagram' },
        { file: 'tags-youtubeshorts.json', platform: 'YouTube Shorts' },
        { file: 'tags-youtubelong.json', platform: 'YouTube Long' },
        { file: 'tags-facebookreels.json', platform: 'Facebook Reels' }
      ];

      for (const { file, platform } of tagFiles) {
        try {
          let tagData: TagDatabase | null = null;

          if (USE_CLOUD_DB) {
            // Fetch from GitHub
            console.log(`Fetching ${file} from GitHub...`);
            tagData = await this.fetchFromGitHub(file);
          }

          // Fallback to local file if GitHub fails or cloud not enabled
          if (!tagData) {
            const tagPath = path.join(hashyDir, file);
            if (fs.existsSync(tagPath)) {
              tagData = JSON.parse(fs.readFileSync(tagPath, 'utf-8'));
              console.log(`Loaded ${file} from local file`);
            }
          }

          if (tagData) {
            this.tagDatabases.set(tagData.platform, tagData);
            console.log(`Loaded ${tagData.tags.length} tags for ${tagData.platform}`);
          }
        } catch (error) {
          console.warn(`Failed to load tag database: ${file}`, error);
        }
      }
    } catch (error) {
      console.error('Error loading Hashy databases:', error);
    }
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
  private getTagDatabase(platformName: string): TagDatabase | null {
    // Normalize platform name for exact matching
    const normalized = platformName.toLowerCase().replace(/\s+/g, '');
    
    // Platform name mapping for exact matching
    const platformMapping: Record<string, string> = {
      'tiktok': 'TikTok',
      'instagram': 'Instagram',
      'youtubeshorts': 'YouTube Shorts',
      'youtubelong': 'YouTube Long',
      'facebookreels': 'Facebook Reels',
      'youtube shorts': 'YouTube Shorts',
      'youtube long': 'YouTube Long',
      'facebook reels': 'Facebook Reels'
    };
    
    // Get the exact platform name from mapping
    const exactPlatformName = platformMapping[normalized] || platformName;
    
    // Return the exact match only
    return this.tagDatabases.get(exactPlatformName) || null;
  }

  /**
   * Get algorithm insights for a specific platform
   */
  private getAlgorithmInsights(platformName: string): AlgorithmInsights | null {
    if (!this.algorithmInsights) return null;

    const platformMapping: Record<string, string> = {
      'tiktok': 'tiktok',
      'instagram': 'instagram',
      'youtube shorts': 'youtube-shorts',
      'youtubeshorts': 'youtube-shorts',
      'youtube long': 'youtube-long',
      'youtubelong': 'youtube-long',
      'facebook reels': 'facebook-reels',
      'facebookreels': 'facebook-reels'
    };

    const normalized = platformName.toLowerCase().replace(/\s+/g, '');
    const platformId = platformMapping[normalized] || normalized;

    return this.algorithmInsights.algorithmInsights[platformId] || null;
  }

  /**
   * Generate tags based on detected games, platform, and keywords
   */
  private generateTagsInternal(
    detectedGames: Game[],
    detectedPlatform: Platform | null,
    keywords: string[],
    targetPlatform?: string
  ): { generatedTags: string[], contextualTags: string[], algorithmTips?: string[] } {
    const generatedTags: string[] = [];
    const contextualTags: string[] = [];
    const algorithmTips: string[] = [];

    // Add game-specific tags
    for (const game of detectedGames) {
      generatedTags.push(...game.tags.slice(0, 10));
      contextualTags.push(game.name);
      contextualTags.push(...game.genre.slice(0, 3));
    }

    // Add platform-specific tags
    const platformToUse = targetPlatform || (detectedPlatform?.name || null);
    if (platformToUse) {
      const tagDb = this.getTagDatabase(platformToUse);
      if (tagDb) {
        generatedTags.push(...tagDb.tags.slice(0, 20));
      }

      // Add algorithm-based tips if available
      const insights = this.getAlgorithmInsights(platformToUse);
      if (insights && insights.summaries) {
        algorithmTips.push(...insights.summaries);
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
      contextualTags: uniqueContextual,
      algorithmTips
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
      await this.loadDatabases();
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
    const { generatedTags, contextualTags, algorithmTips } = this.generateTagsInternal(
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
        algorithmTips,
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
      algorithmTips,
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
}

// Export singleton instance
export const hashy = new HashyAlgorithm();
