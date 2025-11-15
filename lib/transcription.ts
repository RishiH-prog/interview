// Transcription utilities

export interface TranscriptionResult {
  hindiText?: string;
  englishText: string;
  segments?: Array<{ start: number; end: number; text: string; speaker?: string }>;
  speakers?: string[];
}

/**
 * Transcribe Hindi audio using ElevenLabs Scribe v2 Realtime
 * @param audioFile - The audio file to transcribe
 */
async function transcribeWithElevenLabs(audioFile: File): Promise<string> {
  const fileSizeMB = audioFile.size / (1024 * 1024);
  const VERCEL_SIZE_LIMIT_MB = 20; // Use Supabase for files > 20MB to avoid Vercel's 25MB limit
  
  let fileUrl: string | null = null;
  
  // For large files (>20MB), upload directly to Supabase Storage from client to bypass Vercel's 25MB limit
  if (fileSizeMB > VERCEL_SIZE_LIMIT_MB) {
    console.log(`[ElevenLabs] File is ${fileSizeMB.toFixed(2)}MB, uploading directly to Supabase Storage...`);
    
    try {
      // Import Supabase client (already configured with NEXT_PUBLIC_ variables)
      const { supabase } = await import('./supabase');
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `audio-uploads/${timestamp}-${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Convert file to array buffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      console.log(`[ElevenLabs] Uploading ${fileSizeMB.toFixed(2)}MB to Supabase Storage bucket 'audio-files'...`);
      
      // Upload directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, arrayBuffer, {
          contentType: audioFile.type || 'audio/mpeg',
          upsert: false,
        });
      
      if (uploadError) {
        throw new Error(`Failed to upload to Supabase: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);
      
      fileUrl = urlData.publicUrl;
      console.log(`[ElevenLabs] File uploaded to Supabase: ${fileUrl}`);
    } catch (error) {
      console.error('[ElevenLabs] Supabase upload error:', error);
      // Fallback: try using the API route (might fail for very large files)
      console.log('[ElevenLabs] Falling back to API route upload...');
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', audioFile);
      
      const uploadResponse = await fetch('/api/upload-to-supabase', {
        method: 'POST',
        body: uploadFormData,
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        fileUrl = uploadData.fileUrl;
        console.log(`[ElevenLabs] File uploaded via API: ${fileUrl}`);
      } else {
        throw new Error('Failed to upload large file. Please ensure Supabase Storage is configured.');
      }
    }
  }
  
  // Create form data for transcription
  const formData = new FormData();
  
  if (fileUrl) {
    // Use URL for large files
    formData.append('fileUrl', fileUrl);
  } else {
    // Direct file upload for smaller files
    formData.append('file', audioFile);
  }
  
  const response = await fetch('/api/transcribe-elevenlabs', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'ElevenLabs transcription failed' }));
    throw new Error(error.error || 'ElevenLabs transcription failed');
  }

  const data = await response.json();
  
  // If diarization data is available, log it
  if (data.speakers && data.speakers.length > 0) {
    console.log(`[ElevenLabs] Detected ${data.speakers.length} speaker(s): ${data.speakers.join(', ')}`);
  }
  
  // Return the transcript text (which may include speaker labels if diarization is enabled)
  return data.text;
}

/**
 * Translate Hindi text to English using OpenAI GPT
 * Automatically handles chunking for long texts
 */
async function translateHindiToEnglish(hindiText: string): Promise<string> {
  const textLength = hindiText.length;
  console.log(`[Translation] Starting translation of ${textLength} characters...`);
  
  // Calculate expected time based on text length
  // GPT-5 may be slower: roughly 60-90 seconds per chunk
  // Chunks are processed in parallel, so timeout = time for slowest chunk + overhead
  const estimatedChunks = Math.ceil(textLength / 6000);
  const estimatedTimePerChunk = 120000; // 2 minutes per chunk (conservative for GPT-5)
  const overhead = 60000; // 1 minute overhead for parallel processing and network
  const estimatedTimeMs = Math.max(
    300000, // Minimum 5 minutes
    estimatedTimePerChunk + overhead // Time for slowest chunk + overhead (chunks process in parallel)
  );
  const timeoutMs = Math.min(600000, estimatedTimeMs); // Max 10 minutes
  
  console.log(`[Translation] Timeout set to ${(timeoutMs / 1000 / 60).toFixed(1)} minutes for ${textLength} characters`);
  
  const response = await fetch('/api/translate-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: hindiText,
    }),
    signal: AbortSignal.timeout(timeoutMs), // Dynamic timeout based on text length
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Translation failed' }));
    const errorMessage = errorData.error || errorData.message || 'Translation failed';
    console.error(`[Translation] Failed (${response.status}):`, errorMessage);
    throw new Error(`Translation failed: ${errorMessage}`);
  }

  const data = await response.json();
  const englishText = data.text;
  
  if (!englishText || englishText.trim().length === 0) {
    throw new Error('Translation returned empty text');
  }
  
  console.log(`[Translation] Complete: ${englishText.length} characters translated`);
  return englishText;
}

/**
 * Transcribe Hindi audio and translate to English using ElevenLabs Scribe v2 Realtime
 * Returns both Hindi and English transcripts
 * Uses only ElevenLabs - no fallbacks
 */
export async function transcribeHindiAudio(audioFile: File): Promise<TranscriptionResult> {
  const fileSize = audioFile.size;
  const fileSizeMB = fileSize / (1024 * 1024);

  try {
    console.log(`[ElevenLabs Scribe v2] Starting transcription for ${fileSizeMB.toFixed(2)}MB file...`);
    console.log('Step 1: Transcribing Hindi audio with ElevenLabs Scribe v2 Realtime...');
    
    const hindiText = await transcribeWithElevenLabs(audioFile);
    console.log(`✓ Hindi transcript received (${hindiText.length} characters)`);
    console.log('Hindi preview:', hindiText.substring(0, 100) + '...');
    
    if (!hindiText || hindiText.trim().length === 0) {
      throw new Error('Empty Hindi transcript received from ElevenLabs');
    }

    console.log('Step 2: Translating Hindi text to English...');
    const englishText = await translateHindiToEnglish(hindiText);
    console.log(`✓ English translation received (${englishText.length} characters)`);
    console.log('English preview:', englishText.substring(0, 100) + '...');
    console.log('✓ ElevenLabs Scribe v2 Realtime transcription and translation successful');
    
    return { hindiText, englishText };
  } catch (error) {
    console.error('[ElevenLabs] Transcription error:', error);
    throw error;
  }
}

/**
 * Use OpenAI GPT to extract answers from English transcript based on questions
 */
export async function extractAnswersWithGPT(
  englishTranscript: string,
  questions: string[]
): Promise<Array<{ question: string; answer: string }>> {
  const response = await fetch('/api/extract-answers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript: englishTranscript,
      questions,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Answer extraction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.answers;
}

/**
 * Parse transcription text to match questions and extract answers (DEPRECATED - use GPT instead)
 * This is a simple heuristic-based parser - can be improved with AI
 */
export function parseAnswersFromTranscription(
  transcription: string,
  questions: string[]
): Array<{ question: string; answer: string }> {
  const answers: Array<{ question: string; answer: string }> = [];
  
  // Split transcription into sentences/paragraphs
  const sentences = transcription
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Simple approach: Try to match questions to answers
  // This looks for question keywords or patterns and extracts following text
  
  let currentAnswer = '';
  let currentQuestionIndex = 0;
  
  // Split by common question patterns
  const questionKeywords = questions.map(q => {
    // Extract key words from question (first 3-5 words)
    const words = q.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
    return words;
  });

  // Try to find where each question is answered
  const transcriptionLower = transcription.toLowerCase();
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionKey = questionKeywords[i];
    
    // Try to find the answer by looking for question keywords in transcription
    let answer = '';
    
    // Method 1: Look for question number followed by answer
    const questionNumPattern = new RegExp(`(?:question\\s*${i + 1}|q\\s*${i + 1}|${i + 1}\\.?)\\s*[:\\-]?\\s*(.+?)(?=(?:question\\s*${i + 2}|q\\s*${i + 2}|${i + 2}\\.|$))`, 'is');
    const match1 = transcription.match(questionNumPattern);
    if (match1) {
      answer = match1[1].trim();
    } else {
      // Method 2: Look for question keywords in transcription
      const questionWords = questionKey.split(' ').slice(0, 3);
      const searchPattern = new RegExp(`(?:${questionWords.join('|')}).*?([^.!?]+(?:[.!?][^.!?]+)*)`, 'is');
      const match2 = transcription.match(searchPattern);
      if (match2) {
        answer = match2[1].trim();
      } else {
        // Method 3: Split transcription equally among questions
        const totalLength = transcription.length;
        const perQuestion = Math.floor(totalLength / questions.length);
        const start = i * perQuestion;
        const end = i === questions.length - 1 ? totalLength : (i + 1) * perQuestion;
        answer = transcription.slice(start, end).trim();
      }
    }
    
    // Clean up answer
    answer = answer
      .replace(/^(?:question\s*\d+|q\s*\d+|\d+\.?)\s*[:\\-]?\s*/i, '')
      .replace(/^\s*(?:answer|ans|a\.?)\s*[:\\-]?\s*/i, '')
      .trim();
    
    // If answer is too short or seems like a question, use fallback
    if (answer.length < 10 || answer.match(/\?$/)) {
      answer = `[Transcribed]: ${transcription.slice(0, Math.min(200, transcription.length))}...`;
    }
    
    answers.push({
      question,
      answer: answer || `[Unable to extract specific answer from transcription]`,
    });
  }

  // If we couldn't parse well, use the full transcription for all answers
  // This is a fallback - in practice, you might want more sophisticated parsing
  if (answers.every(a => a.answer.includes('[Unable to extract'))) {
    // Split transcription into roughly equal parts for each question
    const chunkSize = Math.ceil(transcription.length / questions.length);
    return questions.map((question, index) => {
      const start = index * chunkSize;
      const end = index === questions.length - 1 ? transcription.length : (index + 1) * chunkSize;
      return {
        question,
        answer: transcription.slice(start, end).trim() || '[No answer extracted]',
      };
    });
  }

  return answers;
}

/**
 * Smart parsing using timestamps if available
 * DEPRECATED: This function is not used - we use GPT for answer extraction instead
 */
export function parseAnswersWithTimestamps(
  transcription: TranscriptionResult,
  questions: string[]
): Array<{ question: string; answer: string }> {
  if (!transcription.segments) {
    return parseAnswersFromTranscription(transcription.englishText, questions);
  }

  // Group segments by time proximity
  // This is a simplified version - you could use more sophisticated NLP here
  const segments = transcription.segments;
  const totalDuration = segments[segments.length - 1]?.end || 0;
  const durationPerQuestion = totalDuration / questions.length;

  return questions.map((question, index) => {
    const startTime = index * durationPerQuestion;
    const endTime = (index + 1) * durationPerQuestion;

    const relevantSegments = segments.filter(
      seg => seg.start >= startTime && seg.end <= endTime
    );

    const answer = relevantSegments
      .map(seg => seg.text)
      .join(' ')
      .trim();

    return {
      question,
      answer: answer || `[No answer in time range ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s]`,
    };
  });
}

