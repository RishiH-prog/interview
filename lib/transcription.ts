// Transcription utilities

export interface TranscriptionResult {
  hindiText?: string;
  englishText: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

/**
 * Transcribe Hindi audio and translate to English
 * Returns both Hindi and English transcripts
 */
export async function transcribeHindiAudio(audioFile: File): Promise<TranscriptionResult> {
  // Step 1: Transcribe in Hindi
  const hindiFormData = new FormData();
  hindiFormData.append('file', audioFile);
  hindiFormData.append('model', 'whisper-1');
  hindiFormData.append('language', 'hi');

  const hindiResponse = await fetch('/api/transcribe', {
    method: 'POST',
    body: hindiFormData,
  });

  if (!hindiResponse.ok) {
    const error = await hindiResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Hindi transcription failed: ${hindiResponse.statusText}`);
  }

  const hindiData = await hindiResponse.json();
  const hindiText = hindiData.text;

  // Step 2: Translate Hindi to English using Whisper translation endpoint
  const englishFormData = new FormData();
  englishFormData.append('file', audioFile);
  englishFormData.append('model', 'whisper-1');

  const englishResponse = await fetch('/api/translate', {
    method: 'POST',
    body: englishFormData,
  });

  if (!englishResponse.ok) {
    const error = await englishResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Translation failed: ${englishResponse.statusText}`);
  }

  const englishData = await englishResponse.json();
  const englishText = englishData.text;

  return {
    hindiText,
    englishText,
    segments: englishData.segments || null,
  };
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
 */
export function parseAnswersWithTimestamps(
  transcription: TranscriptionResult,
  questions: string[]
): Array<{ question: string; answer: string }> {
  if (!transcription.segments) {
    return parseAnswersFromTranscription(transcription.text, questions);
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

