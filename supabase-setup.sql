-- Supabase Database Setup for Ankur Interview Platform
-- Run this SQL in your Supabase SQL Editor

-- Create guides table
CREATE TABLE IF NOT EXISTS guides (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  questions JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
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

-- Enable Row Level Security (RLS)
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for demo - restrict in production)
-- These policies allow anyone to read/write data
-- You can restrict this later based on authentication

-- Drop existing policies if they exist (allows re-running this script)
DROP POLICY IF EXISTS "Allow all operations on guides" ON guides;
DROP POLICY IF EXISTS "Allow all operations on interviews" ON interviews;

CREATE POLICY "Allow all operations on guides" ON guides
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on interviews" ON interviews
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_guides_active ON guides(active);
CREATE INDEX IF NOT EXISTS idx_interviews_guide_id ON interviews(guide_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(date);

-- Optional: Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

