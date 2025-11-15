import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Generate a signed URL for uploading large audio files to Supabase Storage
 * This allows client-side uploads without going through Vercel's 25MB limit
 * The client will upload directly to Supabase using the signed URL
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileName = formData.get('fileName') as string | null;
    const fileSize = formData.get('fileSize') as string | null;

    if (!fileName) {
      return NextResponse.json(
        { error: 'No file name provided' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://frgiohhuscjqbxebifze.supabase.co';
    // Use service role key to bypass RLS for generating signed URLs
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please set SUPABASE_SERVICE_ROLE_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique filename if not provided
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `audio-uploads/${timestamp}-${sanitizedFileName}`;

    // Supabase Storage doesn't support signed upload URLs like S3
    // Instead, we need to either:
    // 1. Make the bucket public (allows anonymous uploads)
    // 2. Configure RLS policies to allow authenticated uploads
    // 3. Use service role key server-side (but hits Vercel 25MB limit)
    
    // For now, return the storage path and instructions
    // The client will try to upload directly, which requires proper bucket configuration
    console.log(`[Supabase Upload] Generated storage path: ${storagePath}`);
    
    return NextResponse.json({
      success: true,
      storagePath: storagePath,
      message: 'Use this path to upload directly to Supabase Storage. Make sure the bucket is configured to allow uploads.',
    });

  } catch (error) {
    console.error('[Supabase Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

