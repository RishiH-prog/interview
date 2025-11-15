# Fix for Large Audio File Uploads

## Problem
Vercel has a 25MB limit for serverless function request bodies. Audio files larger than this cause a 413 error.

## Solutions Implemented

### 1. Increased Timeout
- API routes now have 5-minute timeout (`maxDuration = 300`)
- Allows processing of larger files without timeout errors

### 2. Better Error Messages
- Clear error messages when files exceed size limits
- Suggestions for users to compress audio files

### 3. Configuration Updates
- Updated `next.config.js` with increased body size limits (100MB)
- Note: Vercel still enforces 25MB limit on serverless functions

## Recommended Solutions

### Option 1: Compress Audio Files (Easiest)
Before uploading, compress audio files:
- Use online tools like [CloudConvert](https://cloudconvert.com) or [Audacity](https://www.audacityteam.org)
- Reduce bitrate or sample rate
- Target: Under 20MB for safety

### Option 2: Split Large Files
For very long interviews:
- Split audio into segments (e.g., 10-minute chunks)
- Process each segment separately
- Combine transcripts manually

### Option 3: Use Supabase Storage (Advanced)
1. Upload large files to Supabase Storage
2. Process from Supabase Storage URL
3. Requires additional setup

### Option 4: Direct Client Upload (Not Recommended)
Upload directly from client to OpenAI:
- Requires exposing API key to client (security risk)
- Not recommended for production

## Current Limits

- **Vercel Serverless Function**: 25MB request body limit
- **OpenAI Whisper API**: 25MB file size limit
- **Function Timeout**: Now set to 5 minutes (300 seconds)

## Best Practice

For production, implement audio compression on the client side before upload:

```javascript
// Example: Compress audio before upload
const compressAudio = async (file: File): Promise<File> => {
  // Use Web Audio API or similar to compress
  // Target: Reduce to < 20MB
};
```

## File Size Calculation

- **1 minute of audio** ≈ 1-2MB (depending on quality)
- **10 minutes** ≈ 10-20MB
- **20 minutes** ≈ 20-40MB
- **Recommended max**: 15-20 minutes per file

