# Database Setup Guide - Cross-Device Data Persistence

Currently, the app uses **localStorage** which stores data only on each device. To make data persistent across all devices (phone, laptop, etc.), you need a backend database.

## Why localStorage Doesn't Work Across Devices

- **localStorage** is stored in each browser/device
- Your phone has its own localStorage
- Your laptop has its own localStorage
- They don't share data

## Solution: Use a Backend Database

### Option 1: Supabase (Recommended - Free & Easy)

**Supabase** is a free PostgreSQL database that works great with Next.js.

#### Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Sign up for free
3. Create a new project
4. Wait for project to be created (~2 minutes)

#### Step 2: Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run the SQL from `supabase-setup.sql` file, or copy-paste this:

```sql
-- Create guides table
CREATE TABLE guides (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  questions JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create interviews table
CREATE TABLE interviews (
  id TEXT PRIMARY KEY,
  guide_id TEXT NOT NULL,
  guide_name TEXT NOT NULL,
  interviewer TEXT NOT NULL,
  date TEXT NOT NULL,
  village TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  audio_file TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'AI-generated', 'Approved')),
  answers JSONB NOT NULL,
  hindi_transcript TEXT,
  english_transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - for now, allow all (you can restrict later)
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for demo - restrict in production)
CREATE POLICY "Allow all operations on guides" ON guides
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on interviews" ON interviews
  FOR ALL USING (true) WITH CHECK (true);
```

#### Step 3: Get API Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`) - Already set in code
   - **anon/public key** (starts with `eyJ...`)

#### Step 4: Add Environment Variable to Vercel

In your Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - **Name**: `NEXT_PUBLIC_SUPABASE_KEY`
   - **Value**: Your Supabase anon/public key (starts with `eyJ...`)
   - **Environment**: Select all (Production, Preview, Development)
3. Click **Save**

**Note**: The Supabase URL is already hardcoded in `lib/supabase.ts`. If you want to make it configurable, you can also add `NEXT_PUBLIC_SUPABASE_URL` as an environment variable.

#### Step 5: Redeploy

After adding the environment variable, redeploy your Vercel app. The code is already set up to use Supabase!

### Option 2: Firebase Firestore (Free)

1. Go to [firebase.google.com](https://firebase.google.com)
2. Create a project
3. Enable Firestore Database
4. Install: `npm install firebase`
5. Configure Firebase in your app

### Option 3: MongoDB Atlas (Free)

1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create free cluster
3. Get connection string
4. Install: `npm install mongodb`
5. Configure MongoDB in your app

## Quick Start with Supabase

✅ **Supabase integration is already implemented!** Just follow these steps:

1. **Set up Supabase** (follow steps above)
2. **Run the SQL** from `supabase-setup.sql` in Supabase SQL Editor
3. **Get your anon key** from Supabase dashboard
4. **Add environment variable** to Vercel:
   - `NEXT_PUBLIC_SUPABASE_KEY` = Your Supabase anon key
5. **Redeploy** your Vercel app

The code will automatically:
- Use Supabase if the environment variable is set
- Fall back to localStorage if Supabase is not configured
- Sync data to both Supabase and localStorage for backup

## Current Status

The app currently uses **localStorage** for simplicity. To enable cross-device persistence:

- ✅ **LocalStorage** (current): Fast, works offline, but device-specific
- ⏳ **Database** (needed for cross-device): Requires setup, but works everywhere

## Migration Path

1. Keep localStorage as fallback
2. Add database functions
3. Check if database is configured
4. Use database if available, localStorage otherwise
5. Gradually migrate all users to database

## Need Help?

- [Supabase Docs](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

