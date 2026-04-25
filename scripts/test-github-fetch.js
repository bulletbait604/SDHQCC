const fs = require('fs');
const path = require('path');

// Read .env.local file directly
const envPath = path.join(__dirname, '../.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
  console.log('✅ .env.local file found');
} else {
  console.log('❌ .env.local file not found');
  process.exit(1);
}

// Parse environment variables
const useCloudDb = envContent.match(/^USE_CLOUD_DB=(.+)$/m);
const githubUsername = envContent.match(/^GITHUB_USERNAME=(.+)$/m);
const githubRepo = envContent.match(/^GITHUB_REPO=(.+)$/m);
const githubBranch = envContent.match(/^GITHUB_BRANCH=(.+)$/m);

console.log('\n=== Current Configuration ===');
console.log('USE_CLOUD_DB:', useCloudDb ? useCloudDb[1].trim() : 'NOT SET');
console.log('GITHUB_USERNAME:', githubUsername ? githubUsername[1].trim() : 'NOT SET');
console.log('GITHUB_REPO:', githubRepo ? githubRepo[1].trim() : 'NOT SET');
console.log('GITHUB_BRANCH:', githubBranch ? githubBranch[1].trim() : 'NOT SET');

if (!useCloudDb || useCloudDb[1].trim() !== 'true') {
  console.log('\n⚠️  USE_CLOUD_DB is not set to "true"');
  console.log('Hashy will use local files instead of GitHub');
}

if (!githubUsername || !githubRepo) {
  console.log('\n❌ GITHUB_USERNAME or GITHUB_REPO not set');
  console.log('GitHub fetch will not work');
  process.exit(1);
}

// Test GitHub fetch
console.log('\n=== Testing GitHub Fetch ===');
const username = githubUsername[1].trim();
const repo = githubRepo[1].trim();
const branch = githubBranch ? githubBranch[1].trim() : 'main';

const testUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/tags-tiktok.json`;
console.log(`Testing URL: ${testUrl}`);

fetch(testUrl)
  .then(response => {
    if (response.ok) {
      console.log('✅ GitHub fetch successful!');
      return response.json();
    } else {
      console.log(`❌ GitHub fetch failed: ${response.status} ${response.statusText}`);
      console.log('\nPossible issues:');
      console.log('1. Repository does not exist');
      console.log('2. Repository is private (must be public)');
      console.log('3. File does not exist in repository');
      console.log('4. Branch name is incorrect');
      process.exit(1);
    }
  })
  .then(data => {
    console.log(`✅ Fetched ${data.tags.length} tags from GitHub`);
    console.log(`Platform: ${data.platform}`);
    console.log(`Version: ${data.version}`);
    console.log('\n✅ Hashy will use GitHub for tag databases');
  })
  .catch(error => {
    console.log('❌ Error fetching from GitHub:', error.message);
    console.log('\nPossible issues:');
    console.log('1. Network connectivity');
    console.log('2. Repository does not exist');
    console.log('3. Repository is private (must be public)');
    process.exit(1);
  });
