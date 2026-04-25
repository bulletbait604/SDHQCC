const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf-8');

// Fix GITHUB_USERNAME - remove "your-" prefix if present
envContent = envContent.replace(/^GITHUB_USERNAME=your-bulletbait604$/m, 'GITHUB_USERNAME=bulletbait604');
envContent = envContent.replace(/^GITHUB_USERNAME=your-username$/m, 'GITHUB_USERNAME=bulletbait604');

fs.writeFileSync(envPath, envContent);
console.log('✅ Fixed GITHUB_USERNAME in .env.local');
console.log('GITHUB_USERNAME is now: bulletbait604');
