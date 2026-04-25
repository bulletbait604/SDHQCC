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

console.log('=== MongoDB Connection Test ===\n');

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env.local file');
  console.error('Please make sure .env.local exists and contains MONGODB_URI=...');
  process.exit(1);
}

console.log('Connection string found in .env.local');
console.log('URI:', uri.replace(/:[^:@]+@/, ':****@')); // Hide password
console.log('');

async function testConnection() {
  const client = new MongoClient(uri);
  
  try {
    console.log('Attempting to connect to MongoDB...');
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!\n');
    
    // List databases
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    console.log('Available databases:');
    databases.databases.forEach(db => {
      console.log(`  - ${db.name}`);
    });
    console.log('');
    
    // Check if hashy_tags database exists
    const db = client.db('hashy_tags');
    const collections = await db.listCollections().toArray();
    console.log('Collections in hashy_tags database:');
    if (collections.length === 0) {
      console.log('  (No collections found - database exists but is empty)');
    } else {
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    }
    console.log('');
    
    console.log('✅ Connection test successful!');
    
  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Possible causes:');
    console.error('1. Cluster does not exist or name is incorrect');
    console.error('2. Cluster is paused (check MongoDB Atlas dashboard)');
    console.error('3. Username/password is incorrect');
    console.error('4. IP address not whitelisted in Network Access');
    console.error('5. Connection string format is incorrect');
    console.error('');
    console.error('To fix:');
    console.error('- Go to MongoDB Atlas and verify cluster exists');
    console.error('- Check Network Access settings');
    console.error('- Verify username/password in Database Access');
    console.error('- Copy connection string directly from Atlas');
  } finally {
    await client.close();
  }
}

testConnection();
