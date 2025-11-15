# Local Deepgram Setup

## Quick Setup for Local Testing

### 1. Create `.env.local` file

Create a file named `.env.local` in the root of your project (same folder as `package.json`):

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### 2. Get Your Deepgram API Key

1. Go to [https://deepgram.com](https://deepgram.com)
2. Sign up for a free account (get $200 free credits)
3. Go to your dashboard → API Keys
4. Copy your API key
5. Paste it in `.env.local`

### 3. Restart Your Dev Server

⚠️ **IMPORTANT**: After adding `.env.local`, you MUST restart your Next.js dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 4. Test It

1. Upload a Hindi audio file
2. Check the browser console - you should see:
   - "Attempting Deepgram for fast transcription..."
   - "Step 1: Transcribing Hindi audio..."
   - "✓ Hindi transcript received"
   - "Step 2: Translating Hindi to English..."
   - "✓ English translation received"

## How It Works

The system will:
1. **First**: Transcribe the Hindi audio → Get Hindi transcript
2. **Second**: Transcribe the same audio with translation → Get English translation

Both transcripts are saved in the interview record.

## Verification

Check your terminal/server logs when you upload a file. You should see:
```
Deepgram API call: Hindi transcription
Deepgram Hindi transcript received (XXX chars)
Deepgram API call: Hindi transcription + English translation
Deepgram English transcript received (XXX chars)
```

## Troubleshooting

### "DEEPGRAM_API_KEY not configured"
- Make sure `.env.local` exists in the project root
- Make sure the key is correct (no quotes, no spaces)
- **Restart your dev server** after adding the key

### "Deepgram not available"
- Check that your API key is valid
- Check your Deepgram account has credits
- Check the browser console for the actual error message

