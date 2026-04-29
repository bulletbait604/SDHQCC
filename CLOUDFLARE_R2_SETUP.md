# Cloudflare R2 Setup Guide

## Overview
Cloudflare R2 is used for storing video files for the Clip Analyzer feature. It bypasses Vercel's 4.5MB file upload limit by allowing direct uploads to R2 storage.

---

## Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Enter your email and password
3. Verify your email address
4. Complete the signup process

---

## Step 2: Enable R2 Storage

1. Log into Cloudflare Dashboard: https://dash.cloudflare.com
2. In the left sidebar, click **"R2"** (under Storage)
3. If you see "R2 is not enabled", click **"Enable R2"**
4. Accept the terms and conditions

---

## Step 3: Create an R2 Bucket

1. Click **"Create bucket"** button
2. **Bucket name**: Enter `sdhq-uploads` (or any name you prefer)
3. **Location**: Choose "Automatic" (recommended)
4. Click **"Create bucket"**

---

## Step 4: Get Your Account ID

1. In the Cloudflare dashboard, look at the right sidebar
2. You'll see **"Account ID"** - copy this long string
3. Save it somewhere - you'll need it for the environment variables

---

## Step 5: Create API Tokens for R2

1. In the left sidebar, click **"Manage R2 API Tokens"**
2. Click **"Create API Token"**
3. **Token name**: `SDHQ-R2-Upload`
4. **Permissions**: Select **"Object Read & Write"**
5. **Bucket scope**: Select your bucket (`sdhq-uploads`)
6. **TTL (expiration)**: Select "Custom" and set far in the future
7. Click **"Create API Token"**
8. **IMPORTANT**: Copy both values now:
   - **Access Key ID**
   - **Secret Access Key**
   > ⚠️ The Secret Access Key is only shown once! If you lose it, you'll need to create a new token.

---

## Step 6: Configure CORS (Important!)

To allow uploads from your website:

1. Go to your R2 bucket (`sdhq-uploads`)
2. Click **"Settings"** tab
3. Scroll down to **"CORS Policy"**
4. Click **"Edit CORS Policy"**
5. Click **"Add CORS Policy"**
6. Enter these settings:
   ```
   Origin: https://sdhqcc.vercel.app
   Methods: GET, PUT, POST, DELETE
   Headers: *
   Max Age: 86400
   ```
7. Click **"Save"**

If you're testing locally, also add:
   ```
   Origin: http://localhost:3000
   ```

---

## Step 7: Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (sdhqcc)
3. Click **"Settings"** tab
4. Click **"Environment Variables"** in the left menu
5. Add these 4 variables one by one:

### Variable 1: R2_ACCOUNT_ID
```
Name: R2_ACCOUNT_ID
Value: [Your Cloudflare Account ID from Step 4]
```

### Variable 2: R2_ACCESS_KEY_ID
```
Name: R2_ACCESS_KEY_ID
Value: [Your Access Key ID from Step 5]
```

### Variable 3: R2_SECRET_ACCESS_KEY
```
Name: R2_SECRET_ACCESS_KEY
Value: [Your Secret Access Key from Step 5]
```

### Variable 4: R2_BUCKET_NAME (Optional)
```
Name: R2_BUCKET_NAME
Value: sdhq-uploads
```
> If you used a different bucket name, enter that instead.

6. For each variable, make sure **"Production"**, **"Preview"**, and **"Development"** are all checked
7. Click **"Save"** for each variable

---

## Step 8: Redeploy to Apply Changes

1. In Vercel dashboard, go to your project
2. Click **"Deployments"** tab
3. Find the latest deployment
4. Click the **"..."** menu → **"Redeploy"**
5. Click **"Redeploy"** to confirm

Wait for the deployment to complete (~1-2 minutes).

---

## Step 9: Test the Upload

1. Go to your website: https://sdhqcc.vercel.app
2. Log in with Kick
3. Go to the **"Clip Analyzer"** tab
4. Select a platform (TikTok, YouTube, etc.)
5. Upload a video file (MP4, under 500MB)
6. Check the browser console (F12) for debug logs

If you see **"Clip Upload: File uploaded to R2 successfully"** in the console, it's working!

---

## Troubleshooting

### "R2 credentials not configured" error
- Double-check all 4 environment variables are set in Vercel
- Make sure there are no extra spaces in the values
- Redeploy after adding variables

### "CORS error" in browser console
- Go back to Step 6 and verify CORS settings
- Make sure the origin matches your exact domain
- If using www, include both www and non-www versions

### "Access Denied" error
- The API token might have expired
- Go back to Step 5 and create a new token
- Update the environment variables with the new keys

### Files not uploading
- Check browser console for detailed error messages
- Verify the file is a valid video format (MP4, WebM, MOV)
- Check Vercel logs in the dashboard for server-side errors

---

## Costs

Cloudflare R2 pricing:
- **Storage**: $0.015 per GB per month
- **Class A Operations** (uploads): $4.50 per million requests
- **Class B Operations** (downloads): $0.36 per million requests
- **No egress fees** (unlike AWS S3)

For typical usage (analyzing a few clips per day), costs will be minimal (under $1/month).

---

## Need Help?

If you get stuck:
1. Check the browser console (F12) for error messages
2. Check Vercel function logs in the dashboard
3. Verify each step was completed correctly
