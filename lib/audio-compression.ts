// Audio compression utilities for large file uploads

/**
 * Compress audio file to target size (default 19MB)
 * Intelligently reduces quality to meet target size
 */
export async function compressAudioFile(
  file: File,
  targetSizeMB: number = 19
): Promise<File> {
  const targetSizeBytes = targetSizeMB * 1024 * 1024;
  
  // If file is already small enough, return as-is
  if (file.size <= targetSizeBytes) {
    console.log(`File already under ${targetSizeMB}MB, no compression needed`);
    return file;
  }

  console.log(`Compressing ${(file.size / 1024 / 1024).toFixed(2)}MB file to under ${targetSizeMB}MB...`);

  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    console.log('Decoding audio file...');
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log(`Original: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
    
    // Calculate compression needed
    const currentSizeMB = file.size / (1024 * 1024);
    const compressionRatio = targetSizeMB / currentSizeMB;
    
    console.log(`Compression ratio needed: ${(compressionRatio * 100).toFixed(1)}%`);
    
    // Strategy: Start with aggressive compression and work backwards
    let targetSampleRate = audioBuffer.sampleRate;
    let targetChannels = audioBuffer.numberOfChannels;
    
    // Always convert to mono for speech (saves 50% and speech doesn't need stereo)
    if (audioBuffer.numberOfChannels > 1) {
      targetChannels = 1;
      console.log('Converting to mono (saves ~50% space)');
    }
    
    // Calculate target sample rate based on compression needed
    // Speech recognition works fine at 16kHz, music needs higher rates
    if (compressionRatio < 0.4) {
      // Very aggressive: 16kHz mono
      targetSampleRate = 16000;
    } else if (compressionRatio < 0.6) {
      // Aggressive: 22kHz mono
      targetSampleRate = 22050;
    } else if (compressionRatio < 0.8) {
      // Moderate: 32kHz mono
      targetSampleRate = 32000;
    } else {
      // Light: 44kHz mono (if was stereo) or keep original
      targetSampleRate = Math.min(44100, audioBuffer.sampleRate);
    }
    
    console.log(`Target: ${targetChannels} channel(s), ${targetSampleRate}Hz`);
    
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      targetChannels,
      Math.floor(audioBuffer.length * (targetSampleRate / audioBuffer.sampleRate)),
      targetSampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    console.log('Rendering compressed audio (this may take a moment)...');
    const compressedBuffer = await offlineContext.startRendering();
    
    console.log(`Compressed: ${compressedBuffer.length} samples`);
    
    // Convert to WAV (16-bit PCM)
    const wavBlob = audioBufferToWav(compressedBuffer);
    const compressedFile = new File(
      [wavBlob],
      file.name.replace(/\.[^/.]+$/, '') + '_compressed.wav',
      { type: 'audio/wav' }
    );
    
    const compressedSizeMB = compressedFile.size / (1024 * 1024);
    console.log(`Compression result: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`);
    
    // If still too large, try even more aggressive compression
    if (compressedFile.size > targetSizeBytes * 1.1) {
      console.warn('First compression not enough, trying more aggressive settings...');
      
      // Try 16kHz mono (minimum for speech)
      if (targetSampleRate > 16000 || targetChannels > 1) {
        const moreAggressiveContext = new OfflineAudioContext(
          1, // Mono
          Math.floor(audioBuffer.length * (16000 / audioBuffer.sampleRate)),
          16000 // 16kHz
        );
        
        const moreAggressiveSource = moreAggressiveContext.createBufferSource();
        moreAggressiveSource.buffer = audioBuffer;
        moreAggressiveSource.connect(moreAggressiveContext.destination);
        moreAggressiveSource.start();
        
        const moreCompressedBuffer = await moreAggressiveContext.startRendering();
        const moreCompressedWav = audioBufferToWav(moreCompressedBuffer);
        const moreCompressedFile = new File(
          [moreCompressedWav],
          file.name.replace(/\.[^/.]+$/, '') + '_compressed.wav',
          { type: 'audio/wav' }
        );
        
        const finalSizeMB = moreCompressedFile.size / (1024 * 1024);
        console.log(`Aggressive compression: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${finalSizeMB.toFixed(2)}MB`);
        
        if (moreCompressedFile.size <= targetSizeBytes * 1.1) {
          return moreCompressedFile;
        }
      }
    }
    
    return compressedFile;
  } catch (error) {
    console.error('Audio compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Convert audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Simple file size check and warning (informational only - no blocking)
 */
export function checkFileSize(file: File, maxSizeMB: number = 9999): {
  isValid: boolean;
  sizeMB: number;
  message?: string;
} {
  const sizeMB = file.size / (1024 * 1024);
  
  // Always valid - no size restrictions (ElevenLabs handles large files)
  // Only provide informational messages
  if (sizeMB > 50) {
    return {
      isValid: true,
      sizeMB,
      message: `Large file (${sizeMB.toFixed(2)}MB). Processing may take a few minutes.`,
    };
  }
  
  if (sizeMB > 20) {
    return {
      isValid: true,
      sizeMB,
      message: `File size: ${sizeMB.toFixed(2)}MB. Processing will begin shortly.`,
    };
  }
  
  return {
    isValid: true,
    sizeMB,
  };
}

