// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://frgiohhuscjqbxebifze.supabase.co';
// Use NEXT_PUBLIC_ prefix for client-side access
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return typeof window !== 'undefined' && supabaseUrl && supabaseKey;
};

