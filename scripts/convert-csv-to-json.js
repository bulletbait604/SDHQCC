const fs = require('fs');
const path = require('path');

const files = [
  { csv: 'D:/SDHQ/files/tiktok_keywords.csv', json: 'lib/hashy/tags-tiktok.json', platform: 'TikTok' },
  { csv: 'D:/SDHQ/files/instagram_keywords.csv', json: 'lib/hashy/tags-instagram.json', platform: 'Instagram' },
  { csv: 'D:/SDHQ/files/youtube_shorts_keywords.csv', json: 'lib/hashy/tags-youtubeshorts.json', platform: 'YouTube Shorts' },
  { csv: 'D:/SDHQ/files/youtube_long_keywords.csv', json: 'lib/hashy/tags-youtubelong.json', platform: 'YouTube Long' },
  { csv: 'D:/SDHQ/files/facebook_reels_keywords.csv', json: 'lib/hashy/tags-facebookreels.json', platform: 'Facebook Reels' }
];

console.log('Converting CSV files to JSON format...\n');

for (const { csv, json, platform } of files) {
  console.log(`Processing ${csv}...`);
  
  try {
    const csvContent = fs.readFileSync(csv, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    const tags = [];
    
    for (const line of dataLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const parts = trimmedLine.split(',');
      if (parts.length < 1) continue;
      
      const hashtag = parts[0].trim();
      
      // Remove # symbol if present
      const cleanTag = hashtag.replace(/^#/, '');
      
      if (cleanTag && cleanTag !== 'hashtag') {
        tags.push(cleanTag);
      }
    }
    
    // Create JSON structure
    const jsonData = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      platform: platform,
      count: tags.length,
      tags: tags
    };
    
    // Ensure directory exists
    const jsonDir = path.dirname(json);
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    // Write JSON file
    fs.writeFileSync(json, JSON.stringify(jsonData, null, 2));
    
    console.log(`✅ Converted ${tags.length} tags to ${json}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${csv}:`, error.message);
  }
}

console.log('\n✅ All conversions complete!');
console.log('\nHashy will now use these new JSON tag databases.');
