# Deepgram Large File Fix

## Problem
Deepgram API returns 400 Bad Request for files > 21MB when uploaded through Next.js API route.

## Root Cause
Next.js/Vercel serverless functions have a **25MB request body limit**. When a large file is uploaded:
1. Client → Next.js API route (hits 25MB limit)
2. Next.js API route → Deepgram (fails)

## Solutions

### Solution 1: Upload Directly to Deepgram (Recommended for Large Files)
For files > 20MB, upload directly from client to Deepgram using a temporary signed URL or direct upload.

### Solution 2: Use Deepgram's URL-Based Transcription
1. Upload file to temporary storage (Supabase Storage, S3, etc.)
2. Pass URL to Deepgram instead of file data
3. Deepgram fetches from URL

### Solution 3: Split Large Files
Split audio into smaller segments (< 20MB each) and process separately.

## Current Implementation
The code now:
- ✅ Better error logging to see exact Deepgram error
- ✅ Handles timeouts
- ✅ Provides helpful error messages
- ⚠️ Still limited by Vercel's 25MB request body limit

## Next Steps
For files > 20MB, consider implementing Solution 2 (URL-based) or Solution 1 (direct upload).

