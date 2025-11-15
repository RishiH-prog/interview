# Fast Transcription Setup Guide

## Current Status
- **Current**: OpenAI Whisper-1 (slow, can take 5+ minutes for long audio)
- **Faster Options**: Deepgram, AssemblyAI, or Replicate's Fast Whisper

## Speed Comparison

| Service | Speed | Cost | Hindi Support |
|--------|-------|------|---------------|
| **Deepgram** | ⚡⚡⚡ Very Fast (seconds) | $0.0043/min | ✅ Yes |
| **AssemblyAI** | ⚡⚡ Fast (1-2 minutes) | $0.00025/sec | ✅ Yes |
| **Replicate Fast Whisper** | ⚡⚡ Fast (1-2 minutes) | ~$0.01/min | ✅ Yes |
| **OpenAI Whisper** | ⚡ Slow (5+ minutes) | $0.006/min | ✅ Yes |

## Recommended: Deepgram (Fastest)

Deepgram is the fastest option and supports Hindi. Here's how to set it up:

### Step 1: Get Deepgram API Key

1. Go to [deepgram.com](https://deepgram.com)
2. Sign up for free account (get $200 free credits)
3. Go to **API Keys** section
4. Create a new API key
5. Copy the key

### Step 2: Add Environment Variable

In your `.env.local` file (or Vercel environment variables):

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### Step 3: Update Code

The code has been updated to support Deepgram. Just set the `DEEPGRAM_API_KEY` environment variable and it will automatically use Deepgram instead of OpenAI Whisper.

## Alternative: AssemblyAI

If you prefer AssemblyAI:

### Step 1: Get AssemblyAI API Key

1. Go to [assemblyai.com](https://assemblyai.com)
2. Sign up for free account
3. Get your API key from dashboard

### Step 2: Add Environment Variable

```bash
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

### Step 3: Update Code

The code supports AssemblyAI as well. Set `ASSEMBLYAI_API_KEY` to use it.

## How It Works

The transcription system will automatically:
1. Check for `DEEPGRAM_API_KEY` first (fastest)
2. Check for `ASSEMBLYAI_API_KEY` second (fast)
3. Fall back to `OPENAI_API_KEY` (slowest but most accurate)

## Cost Comparison

For a 10-minute audio file:
- **Deepgram**: ~$0.04 (very fast)
- **AssemblyAI**: ~$0.15 (fast)
- **OpenAI Whisper**: ~$0.06 (slow)

## Testing

After setting up, test with a small audio file. You should see:
- Deepgram: Transcription in 10-30 seconds
- AssemblyAI: Transcription in 1-2 minutes
- OpenAI: Transcription in 5+ minutes

