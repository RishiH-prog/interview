import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file processing

// This endpoint handles large audio files by uploading to Supabase Storage first
// Then processes them in chunks if needed

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chunkIndex = formData.get('chunkIndex') as string | null;
    const totalChunks = formData.get('totalChunks') as string | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const fileSize = file.size;
    const fileSizeMB = fileSize / (1024 * 1024);

    // No size restrictions - ElevenLabs handles large files well
    // Always allow processing directly
    console.log(`[Upload Audio] Processing file: ${fileSizeMB.toFixed(2)}MB`);
    
    return NextResponse.json({
      success: true,
      shouldProcessDirectly: true,
      fileSizeMB: fileSizeMB.toFixed(2),
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

