import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for large translations with GPT-5

/**
 * Chunk text into smaller segments for translation
 * Splits at sentence boundaries to preserve context
 */
function chunkText(text: string, maxChunkSize: number = 6000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by sentences (periods, question marks, exclamation marks)
  const sentences = text.split(/([।.!?]+\s*)/);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + sentence;
    
    if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Translate a single chunk of Hindi text to English
 */
async function translateChunk(hindiChunk: string, apiKey: string, chunkIndex: number, totalChunks: number): Promise<string> {
  const systemPrompt = totalChunks > 1
    ? `You are a professional translator. Translate the following Hindi text to English. This is chunk ${chunkIndex + 1} of ${totalChunks} of a longer conversation. Maintain the meaning, tone, and context accurately. Only output the translated text, no explanations or additional text.`
    : 'You are a professional translator. Translate the following Hindi text to English. Maintain the meaning, tone, and context accurately. Only output the translated text, no explanations or additional text.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Translate this Hindi text to English:\n\n${hindiChunk}`,
        },
      ],
      // GPT-5 only supports default temperature (1), cannot set custom values
    }),
    signal: AbortSignal.timeout(180000), // 3 minute timeout per chunk (GPT-5 may be slower)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Translation failed' }));
    throw new Error(errorData.error?.message || `Translation failed for chunk ${chunkIndex + 1}: ${response.statusText}`);
  }

  const data = await response.json();
  const englishText = data.choices?.[0]?.message?.content?.trim() || '';

  if (!englishText) {
    throw new Error(`No translation received for chunk ${chunkIndex + 1}`);
  }

  return englishText;
}

/**
 * Translate Hindi text to English using OpenAI GPT
 * Automatically chunks large text for efficient translation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hindiText = body.text;

    if (!hindiText) {
      return NextResponse.json(
        { error: 'No text provided for translation' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Please set it in your .env.local file.' },
        { status: 500 }
      );
    }

    const textLength = hindiText.length;
    console.log(`[Translate] Translating ${textLength} characters of Hindi text...`);

    // Chunk text if it's too long (GPT-5 can handle large context windows)
    // Using 6000 characters as safe limit (approximately 4000-5000 tokens for Hindi text)
    const chunks = chunkText(hindiText, 6000);
    console.log(`[Translate] Split into ${chunks.length} chunk(s) for translation`);

    if (chunks.length === 1) {
      // Single chunk - translate directly
      console.log('[Translate] Translating single chunk...');
      const englishText = await translateChunk(hindiText, apiKey, 0, 1);
      console.log(`[Translate] Translation complete: ${englishText.length} characters`);
      return NextResponse.json({
        text: englishText,
      });
    }

    // Multiple chunks - translate in parallel for speed
    console.log(`[Translate] Translating ${chunks.length} chunks in parallel...`);
    const translationPromises = chunks.map((chunk, index) =>
      translateChunk(chunk, apiKey, index, chunks.length)
        .then(text => {
          console.log(`[Translate] Chunk ${index + 1}/${chunks.length} translated (${text.length} chars)`);
          return text;
        })
        .catch(error => {
          console.error(`[Translate] Error translating chunk ${index + 1}:`, error);
          throw error;
        })
    );

    const translatedChunks = await Promise.all(translationPromises);
    
    // Combine all translated chunks
    const englishText = translatedChunks.join(' ');
    console.log(`[Translate] All chunks translated. Total: ${englishText.length} characters`);

    return NextResponse.json({
      text: englishText,
    });
  } catch (error) {
    console.error('[Translate] Translation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Internal server error during translation',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

