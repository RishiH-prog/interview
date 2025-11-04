import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const model = formData.get('model') || 'whisper-1';

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Please set it in your environment variables.' },
        { status: 500 }
      );
    }

    // Convert File to Blob for OpenAI API
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Create FormData for OpenAI Translations endpoint
    // The translations endpoint automatically translates to English
    const openaiFormData = new FormData();
    openaiFormData.append('file', blob, file.name);
    openaiFormData.append('model', model as string);

    // Call OpenAI Whisper Translations API (translates to English)
    const response = await fetch('https://api.openai.com/v1/audio/translations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.error?.message || 'Translation failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Return translated text (English)
    return NextResponse.json({
      text: data.text,
      segments: data.segments || null,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

