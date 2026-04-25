const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env.local file directly
const envPath = path.join(__dirname, '../.env.local');
let uri = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^MONGODB_URI=(.+)$/m);
  if (match) {
    uri = match[1].trim();
  }
}

if (!uri) {
  console.error('MONGODB_URI not found in .env.local file');
  console.error('Please make sure .env.local exists and contains MONGODB_URI=...');
  process.exit(1);
}
const client = new MongoClient(uri);

// File mapping
const files = [
  { file: path.join(__dirname, '../files/tiktok_keywords.csv'), collection: 'tiktok_tags' },
  { file: path.join(__dirname, '../files/instagram_keywords.csv'), collection: 'instagram_tags' },
  { file: path.join(__dirname, '../files/youtube_shorts_keywords.csv'), collection: 'youtube_shorts_tags' },
  { file: path.join(__dirname, '../files/youtube_long_keywords.csv'), collection: 'youtube_long_tags' },
  { file: path.join(__dirname, '../files/facebook_reels_keywords.csv'), collection: 'facebook_reels_tags' }
];

async function importCSVToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('hashy_tags');
    
    for (const { file, collection } of files) {
      console.log(`\nProcessing ${file}...`);
      
      // Read CSV file
      const csvContent = fs.readFileSync(file, 'utf-8');
      const lines = csvContent.split('\n');
      
      // Skip header line
      const dataLines = lines.slice(1);
      
      const documents = [];
      
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length < 3) continue;
        
        const hashtag = parts[0].trim();
        const platform = parts[1].trim();
        const category = parts[2].trim();
        
        // Remove # symbol if present
        const cleanTag = hashtag.replace(/^#/, '');
        
        if (cleanTag) {
          documents.push({
            tag: cleanTag,
            platform: platform,
            category: category,
            popularity: 100 - (i % 100), // Simple popularity based on order
            createdAt: new Date().toISOString()
          });
        }
      }
      
      console.log(`Found ${documents.length} tags in ${file}`);
      
      // Clear existing data in collection
      await db.collection(collection).deleteMany({});
      console.log(`Cleared existing data from ${collection}`);
      
      // Insert new data
      if (documents.length > 0) {
        await db.collection(collection).insertMany(documents);
        console.log(`Imported ${documents.length} tags to ${collection}`);
      }
    }
    
    console.log('\n✅ All files imported successfully!');
    
    // Print collection stats
    console.log('\nCollection statistics:');
    for (const { collection } of files) {
      const count = await db.collection(collection).countDocuments();
      console.log(`  ${collection}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

importCSVToMongoDB();
