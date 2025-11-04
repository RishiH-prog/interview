// Transcription utilities

export interface TranscriptionResult {
  hindiText?: string;
  englishText: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}


async function splitAudioFile(audioFile: File, segmentMinutes = 10): Promise<File[]> {
  const audioCtx = new AudioContext();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const segmentSamples = segmentMinutes * 60 * audioBuffer.sampleRate;
  const chunks: File[] = [];

  for (let start = 0; start < audioBuffer.length; start += segmentSamples) {
    const end = Math.min(start + segmentSamples, audioBuffer.length);
    const chunkBuffer = audioCtx.createBuffer(
      audioBuffer.numberOfChannels,
      end - start,
      audioBuffer.sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch).slice(start, end);
      chunkBuffer.copyToChannel(channelData, ch, 0);
    }

    // Convert chunkBuffer → WAV Blob
    const wavBlob = bufferToWavBlob(chunkBuffer);
    const chunkFile = new File([wavBlob], `chunk_${chunks.length + 1}.wav`, { type: 'audio/wav' });
    chunks.push(chunkFile);
  }
  return chunks;
}

// --- NEW: convert AudioBuffer → WAV Blob ---
function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const result = new ArrayBuffer(length);
  const view = new DataView(result);
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  // fmt chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  // data chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  // Write interleaved data
  const channels = [];
  for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
  let interleaved = new Float32Array(buffer.length * numOfChan);
  for (let i = 0, index = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) interleaved[index++] = channels[ch][i];
  }

  for (let i = 0; i < interleaved.length; i++, pos += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([result], { type: 'audio/wav' });
}

// --- NEW: Progress callback type ---
export type ProgressCallback = (progress: number) => void;

/**
 * Transcribe long Hindi audio in chunks, avoiding Whisper rate limits
 * Includes optional progress updates
 */
export async function transcribeHindiAudio(
  audioFile: File,
  onProgress?: ProgressCallback
): Promise<TranscriptionResult> {
  // Split file into ~10-minute chunks
  const chunks = await splitAudioFile(audioFile, 5);
  const totalChunks = chunks.length;

  let combinedHindi = '';
  let combinedEnglish = '';
  const allSegments: Array<{ start: number; end: number; text: string }> = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks[i];

    // Step 1: Hindi transcription
    const hindiFormData = new FormData();
    hindiFormData.append('file', chunk);
    hindiFormData.append('model', 'whisper-1');
    hindiFormData.append('language', 'hi');

    const hindiResponse = await fetch('/api/transcribe', {
      method: 'POST',
      body: hindiFormData,
    });

    if (!hindiResponse.ok) {
      const error = await hindiResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Hindi transcription failed for chunk ${i + 1}`);
    }

    const hindiData = await hindiResponse.json();
    combinedHindi += hindiData.text + '\n';

    // Step 2: English translation
    const englishFormData = new FormData();
    englishFormData.append('file', chunk);
    englishFormData.append('model', 'whisper-1');

    const englishResponse = await fetch('/api/translate', {
      method: 'POST',
      body: englishFormData,
    });

    if (!englishResponse.ok) {
      const error = await englishResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Translation failed for chunk ${i + 1}`);
    }

    const englishData = await englishResponse.json();
    combinedEnglish += englishData.text + '\n';
    if (englishData.segments) {
      allSegments.push(...englishData.segments);
    }

    // Update progress (0–100%)
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    // Delay to avoid rate-limit bursts
    await new Promise((r) => setTimeout(r, 1500));
  }

  return {
    hindiText: combinedHindi.trim(),
    englishText: combinedEnglish.trim(),
    segments: allSegments.length > 0 ? allSegments : undefined,
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

