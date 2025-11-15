import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large files

/**
 * ElevenLabs Scribe v2 Realtime Speech-to-Text transcription route
 * Optimized for large Hindi audio files with real-time processing
 * Language code: "hin" for Hindi
 * Uses Scribe v2 Realtime model for best performance
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

    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured. Please set it in your .env.local file (for local) or Vercel environment variables.' },
        { status: 500 }
      );
    }

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`[ElevenLabs Scribe v2] Processing file: ${file.name}, Size: ${fileSizeMB.toFixed(2)}MB, Type: ${file.type}`);

    // Convert File to buffer for ElevenLabs API
    const arrayBuffer = await file.arrayBuffer();

    // ElevenLabs Scribe v2 Realtime endpoint
    // Supports large files and real-time processing with ~150ms latency
    const url = 'https://api.elevenlabs.io/v1/speech-to-text';

    console.log(`[ElevenLabs Scribe v2] Starting Hindi transcription with Scribe v2 Realtime for ${fileSizeMB.toFixed(2)}MB file...`);

    // Create FormData for ElevenLabs
    const elevenLabsFormData = new FormData();
    const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
    elevenLabsFormData.append('file', blob, file.name);
    
    // Add language parameter for Hindi (language code: "hin")
    elevenLabsFormData.append('language', 'hin');
    
    // Use Scribe v2 model (correct model_id from ElevenLabs API)
    // Valid options: 'scribe_v1', 'scribe_v1_experimental', 'scribe_v2'
    elevenLabsFormData.append('model_id', 'scribe_v2');
    
    // Enable speaker diarization (auto-detect number of speakers)
    elevenLabsFormData.append('diarize', 'true');
    
    // Optional: Request word-level timestamps for better granularity
    elevenLabsFormData.append('timestamps_granularity', 'word');

    // Call ElevenLabs API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
        },
        body: elevenLabsFormData,
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
      
      console.error('[ElevenLabs Scribe v2] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        fileSize: `${fileSizeMB.toFixed(2)}MB`,
        fileName: file.name,
        fileType: file.type,
      });
      
      // Provide helpful error messages
      let errorMessage = errorData.error?.message || errorData.message || errorData.detail?.message || errorData.detail || 'ElevenLabs transcription failed';
      
      if (response.status === 400) {
        errorMessage = `ElevenLabs rejected the file. ${errorMessage}. ` +
          `File: ${file.name} (${fileSizeMB.toFixed(2)}MB, type: ${file.type || 'unknown'}). ` +
          `Check if the file format is supported (MP3, WAV, M4A, etc.) and not corrupted.`;
      } else if (response.status === 401) {
        errorMessage = `Invalid ElevenLabs API key. Please check your ELEVENLABS_API_KEY environment variable.`;
      } else if (response.status === 402) {
        errorMessage = `ElevenLabs subscription limit reached. Please check your account usage.`;
      } else if (response.status === 413) {
        errorMessage = `File too large (${fileSizeMB.toFixed(2)}MB). ` +
          `Please compress the file or split it into smaller segments.`;
      } else if (response.status === 422) {
        // 422 Unprocessable Entity - might be model_id issue, try fallback without model_id
        console.log('[ElevenLabs Scribe v2] 422 error - trying without model_id parameter...');
        
        // Retry without model_id (use default model)
        const fallbackFormData = new FormData();
        const fallbackBlob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
        fallbackFormData.append('file', fallbackBlob, file.name);
        fallbackFormData.append('language', 'hin');
        // Don't add model_id - use default
        // Still enable diarization
        fallbackFormData.append('diarize', 'true');
        fallbackFormData.append('timestamps_granularity', 'word');
        
        try {
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 300000);
          
          const fallbackResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
            },
            body: fallbackFormData,
            signal: fallbackController.signal,
          });
          
          clearTimeout(fallbackTimeoutId);
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            let transcript = fallbackData.text || fallbackData.transcription || '';
            let segments = null;
            let speakers = null;
            
            // Process diarization data if available
            if (fallbackData.words || fallbackData.utterances || fallbackData.segments) {
              const diarizedData = fallbackData.words || fallbackData.utterances || fallbackData.segments || [];
              if (Array.isArray(diarizedData) && diarizedData.length > 0) {
                const speakerSet = new Set<string>();
                diarizedData.forEach((item: any) => {
                  if (item.speaker !== undefined) {
                    speakerSet.add(`Speaker ${item.speaker}`);
                  }
                });
                speakers = Array.from(speakerSet);
                
                // Build transcript with speaker labels
                let transcriptWithSpeakers = '';
                let currentSpeaker: string | null = null;
                diarizedData.forEach((item: any) => {
                  const speakerLabel = item.speaker !== undefined ? `Speaker ${item.speaker}` : 'Unknown';
                  const text = item.text || item.word || '';
                  if (speakerLabel !== currentSpeaker) {
                    if (currentSpeaker !== null) transcriptWithSpeakers += '\n';
                    transcriptWithSpeakers += `[${speakerLabel}]: `;
                    currentSpeaker = speakerLabel;
                  }
                  transcriptWithSpeakers += text + ' ';
                });
                if (transcriptWithSpeakers.trim()) {
                  transcript = transcriptWithSpeakers.trim();
                }
              }
            }
            
            if (transcript && transcript.trim().length > 0) {
              console.log(`[ElevenLabs Scribe v2] Fallback successful (${transcript.length} characters)`);
              if (speakers && speakers.length > 0) {
                console.log(`[ElevenLabs Scribe v2] Detected ${speakers.length} speaker(s): ${speakers.join(', ')}`);
              }
              return NextResponse.json({
                text: transcript,
                segments: segments,
                speakers: speakers,
              });
            }
          } else {
            const fallbackErrorText = await fallbackResponse.text().catch(() => '');
            console.error('[ElevenLabs Scribe v2] Fallback also failed:', fallbackResponse.status, fallbackErrorText);
          }
        } catch (fallbackError) {
          console.error('[ElevenLabs Scribe v2] Fallback request failed:', fallbackError);
        }
        
        errorMessage = `ElevenLabs cannot process this file. ${errorMessage}. ` +
          `Possible issues: Unsupported file format (${file.type || 'unknown'}), corrupted file, or invalid model_id. ` +
          `Supported formats: MP3, WAV, M4A, FLAC, OGG. ` +
          `File: ${file.name} (${fileSizeMB.toFixed(2)}MB).`;
      } else if (response.status === 429) {
        errorMessage = `ElevenLabs rate limit exceeded. Please try again in a few moments.`;
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          status: response.status,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract transcript from ElevenLabs response
    // With diarization, ElevenLabs may return structured data with speaker information
    let transcript = data.text || data.transcription || '';
    
    // If diarization is enabled, the response might have segments with speaker info
    let segments = null;
    let speakers = null;
    
    // Check for diarized response format (may have words, utterances, or segments with speaker labels)
    if (data.words || data.utterances || data.segments) {
      // Process diarized response
      const diarizedData = data.words || data.utterances || data.segments || [];
      
      // Extract unique speakers
      if (Array.isArray(diarizedData)) {
        const speakerSet = new Set<string>();
        diarizedData.forEach((item: any) => {
          if (item.speaker !== undefined) {
            speakerSet.add(`Speaker ${item.speaker}`);
          }
        });
        speakers = Array.from(speakerSet);
        
        // Build transcript with speaker labels if available
        if (diarizedData.length > 0 && diarizedData[0].speaker !== undefined) {
          let transcriptWithSpeakers = '';
          let currentSpeaker: string | null = null;
          
          diarizedData.forEach((item: any) => {
            const speakerLabel = item.speaker !== undefined ? `Speaker ${item.speaker}` : 'Unknown';
            const text = item.text || item.word || '';
            
            if (speakerLabel !== currentSpeaker) {
              if (currentSpeaker !== null) {
                transcriptWithSpeakers += '\n';
              }
              transcriptWithSpeakers += `[${speakerLabel}]: `;
              currentSpeaker = speakerLabel;
            }
            
            transcriptWithSpeakers += text + ' ';
          });
          
          if (transcriptWithSpeakers.trim()) {
            transcript = transcriptWithSpeakers.trim();
          }
        }
        
        // Map to segments format if available
        if (data.utterances || data.segments) {
          segments = (data.utterances || data.segments).map((item: any) => ({
            start: item.start || item.start_time || 0,
            end: item.end || item.end_time || 0,
            text: item.text || '',
            speaker: item.speaker !== undefined ? `Speaker ${item.speaker}` : undefined,
          }));
        }
      }
    }
    
    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'No transcript returned from ElevenLabs. The audio may be empty or unsupported.' },
        { status: 500 }
      );
    }

    console.log(`[ElevenLabs Scribe v2] Hindi transcript received (${transcript.length} characters)`);
    if (speakers && speakers.length > 0) {
      console.log(`[ElevenLabs Scribe v2] Detected ${speakers.length} speaker(s): ${speakers.join(', ')}`);
    }
    console.log(`[ElevenLabs Scribe v2] Transcript preview: ${transcript.substring(0, 150)}...`);

    return NextResponse.json({
      text: transcript,
      segments: segments,
      speakers: speakers,
    });
  } catch (error) {
    console.error('[ElevenLabs Scribe v2] Transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

