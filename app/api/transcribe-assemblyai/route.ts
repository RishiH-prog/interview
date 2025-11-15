import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large files

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const language = request.headers.get('language') || 'hi';

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ASSEMBLYAI_API_KEY not configured. Please set it in your environment variables.' },
        { status: 500 }
      );
    }

    // Convert File to Blob for AssemblyAI API
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Step 1: Upload audio file to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to upload audio to AssemblyAI' },
        { status: uploadResponse.status }
      );
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    // Step 2: Submit transcription job
    const languageCode = language === 'hi' ? 'hi' : 'en';
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: languageCode,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorData = await transcriptResponse.json().catch(() => ({ error: 'Transcription failed' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to start transcription' },
        { status: transcriptResponse.status }
      );
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    // Step 3: Poll for transcription result
    let transcriptResult;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 sec intervals)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': apiKey,
        },
      });

      transcriptResult = await statusResponse.json();

      if (transcriptResult.status === 'completed') {
        break;
      }

      if (transcriptResult.status === 'error') {
        return NextResponse.json(
          { error: transcriptResult.error || 'Transcription failed' },
          { status: 500 }
        );
      }

      attempts++;
    }

    if (transcriptResult.status !== 'completed') {
      return NextResponse.json(
        { error: 'Transcription timed out' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text: transcriptResult.text || '',
      segments: null,
    });
  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

