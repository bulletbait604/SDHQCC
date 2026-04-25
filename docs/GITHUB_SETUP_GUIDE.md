# GitHub Setup for Cloud Tag Databases

## Why GitHub?
- Free hosting
- Easy to set up
- No package installation needed
- Files accessible via raw URLs
- Easy to update

## Step 1: Create GitHub Repository

1. Go to https://github.com
2. Click "+" → "New repository"
3. Repository name: `hashy-tag-databases`
4. Make it Public (so raw URLs work without authentication)
5. Click "Create repository"

## Step 2: Upload Your Tag Database Files

1. In your new repository, click "Add file" → "Upload files"
2. Navigate to your project folder: `lib/hashy/`
3. Upload these files:
   - `tags-tiktok.json`
   - `tags-instagram.json`
   - `tags-youtubeshorts.json`
   - `tags-youtubelong.json`
   - `tags-facebookreels.json`
4. Click "Commit changes"

## Step 3: Get Raw URLs

After uploading, you can access files via raw URLs like:
```
https://raw.githubusercontent.com/YOUR_USERNAME/hashy-tag-databases/main/tags-tiktok.json
```

Replace:
- `YOUR_USERNAME` with your GitHub username
- `main` with your branch name (usually main)

## Step 4: Update Hashy to Use GitHub URLs

I'll update the Hashy algorithm to fetch from GitHub instead of local files.

## Step 5: Test

Once updated, Hashy will fetch tag databases from GitHub URLs, making them accessible from anywhere without needing your local computer.
