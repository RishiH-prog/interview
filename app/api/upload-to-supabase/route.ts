import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Upload large audio file to Supabase Storage
 * This bypasses Vercel's 25MB limit by uploading directly to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://frgiohhuscjqbxebifze.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please set SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `audio-uploads/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
    
    console.log(`[Supabase Upload] Uploading ${fileSizeMB.toFixed(2)}MB file: ${fileName}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('audio-files') // Bucket name - make sure this exists in Supabase
      .upload(fileName, arrayBuffer, {
        contentType: file.type || 'audio/mpeg',
        upsert: false,
      });

    if (error) {
      console.error('[Supabase Upload] Error:', error);
      return NextResponse.json(
        { error: `Failed to upload to Supabase: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    console.log(`[Supabase Upload] Successfully uploaded: ${urlData.publicUrl}`);

    return NextResponse.json({
      success: true,
      fileUrl: urlData.publicUrl,
      fileName: fileName,
      fileSizeMB: fileSizeMB.toFixed(2),
    });

  } catch (error) {
    console.error('[Supabase Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

