import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large files

/**
 * Deepgram transcription route
 * Supports two modes:
 * - 'hi': Transcribe Hindi audio → returns Hindi transcript
 * - 'en': Transcribe Hindi audio and translate to English → returns English translation
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = request.headers.get('language') || 'hi'; // 'hi' for Hindi, 'en' for English translation

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Get API key from environment variable (works with .env.local for local development)
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPGRAM_API_KEY not configured. Please set it in your .env.local file (for local) or Vercel environment variables.' },
        { status: 500 }
      );
    }

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Processing file: ${file.name}, Size: ${fileSizeMB.toFixed(2)}MB, Type: ${file.type}`);

    // For files > 25MB, we need to use a different approach
    // Deepgram supports up to 2GB, but Vercel/serverless functions have 25MB limits
    // So we'll stream the file directly to Deepgram
    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log(`File loaded into memory: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

    // Create FormData for Deepgram
    const deepgramFormData = new FormData();
    
    // Use the original file buffer directly
    const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
    deepgramFormData.append('file', blob, file.name);

    // Always transcribe in Hindi (translation happens separately via GPT)
    const url = `https://api.deepgram.com/v1/listen?language=hi&model=nova-2&punctuate=true&diarize=false`;

    console.log(`Deepgram API call: Hindi transcription for ${fileSizeMB.toFixed(2)}MB file`);

    // Call Deepgram API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
        },
        body: deepgramFormData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. File may be too large. Please try a smaller file or split it into segments.' },
          { status: 408 }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }
      
      console.error('Deepgram API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        fileSize: `${fileSizeMB.toFixed(2)}MB`,
        fileName: file.name,
      });
      
      // Provide helpful error messages
      let errorMessage = errorData.error?.message || errorData.message || 'Deepgram transcription failed';
      
      if (response.status === 400) {
        errorMessage = `Deepgram rejected the file. ${errorMessage}. ` +
          `File: ${file.name} (${fileSizeMB.toFixed(2)}MB). ` +
          `Check if the file format is supported and not corrupted.`;
      } else if (response.status === 413) {
        errorMessage = `File too large (${fileSizeMB.toFixed(2)}MB). ` +
          `Please compress the file to under 20MB or split it into smaller segments.`;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract transcript from Deepgram response
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript returned from Deepgram' },
        { status: 500 }
      );
    }

    console.log(`Deepgram ${mode === 'hi' ? 'Hindi' : 'English'} transcript received (${transcript.length} chars)`);

    return NextResponse.json({
      text: transcript,
      segments: null,
    });
  } catch (error) {
    console.error('Deepgram transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

