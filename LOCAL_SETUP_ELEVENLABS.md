# Local Testing Setup for ElevenLabs Integration

## Quick Start

The code is **ready to work locally** - no refactoring needed! Just follow these steps:

## Step 1: Create `.env.local` file

1. In the root directory of your project, create a file named `.env.local`
2. Add the following environment variables:

```bash
# REQUIRED: ElevenLabs API Key for Hindi transcription
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# REQUIRED: OpenAI API Key for translation (Hindi → English) and answer extraction
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Step 2: Get Your API Keys

### ElevenLabs API Key
1. Go to [https://elevenlabs.io/](https://elevenlabs.io/)
2. Sign up or log in
3. Navigate to your **Profile** → **API Settings** (or similar)
4. Generate a new API key
5. Copy the key and paste it in `.env.local`

### OpenAI API Key
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`) and paste it in `.env.local`

## Step 3: Install Dependencies (if not already done)

```bash
npm install
```

## Step 4: Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Step 5: Test the Integration

1. Open `http://localhost:3000` in your browser
2. Navigate to "Add Interview (Employee)" section
3. Select a guide (or upload one first)
4. Fill in the interview details
5. **Upload a Hindi audio file** (preferably a large one to test ElevenLabs)
6. Click "Create Interview"
7. Watch the console logs for:
   - `[ElevenLabs] Processing file...`
   - `[ElevenLabs] Hindi transcript received...`
   - Translation progress

## How It Works Locally

✅ **No code changes needed** - The implementation already works for local development:

- **API Routes** (`app/api/transcribe-elevenlabs/route.ts`): Uses `process.env.ELEVENLABS_API_KEY` which Next.js automatically loads from `.env.local`
- **Client Code** (`lib/transcription.ts`): Calls `/api/transcribe-elevenlabs` which works locally (Next.js dev server handles this)
- **Environment Variables**: Next.js automatically loads `.env.local` in development mode

## Troubleshooting

### "ELEVENLABS_API_KEY not configured" error

1. Make sure `.env.local` is in the **root directory** (same level as `package.json`)
2. Make sure the file is named exactly `.env.local` (not `.env.local.txt`)
3. **Restart the dev server** after creating/modifying `.env.local`:
   ```bash
   # Stop the server (Ctrl+C) and restart:
   npm run dev
   ```
4. Verify your API key is correct (no extra spaces, quotes, or newlines)

### "OPENAI_API_KEY not configured" error

- Same steps as above, but for `OPENAI_API_KEY`
- Make sure your OpenAI key starts with `sk-`

### "ElevenLabs API error: 401"

- Your ElevenLabs API key is invalid or expired
- Get a new API key from your ElevenLabs account
- Update `.env.local` and restart the dev server

### "ElevenLabs API error: 402"

- Your ElevenLabs subscription has reached its usage limit
- Check your ElevenLabs account for usage/quota information

### Transcription works but translation fails

- Check that `OPENAI_API_KEY` is set correctly
- Verify you have credits in your OpenAI account
- Check the browser console for specific error messages

## Testing Large Files

To test the large file handling feature:

1. Use a Hindi audio file > 15MB (or > 8 minutes duration)
2. Upload it through the interface
3. Check the console logs - you should see:
   ```
   [ElevenLabs] Processing file: your-file.mp3, Size: XX.XXMB
   Attempting ElevenLabs for transcription (large file - will auto-segment)...
   ```
4. ElevenLabs will automatically segment files > 8 minutes in parallel

## Example `.env.local` File

```bash
ELEVENLABS_API_KEY=abc123xyz456789
OPENAI_API_KEY=sk-proj-abc123xyz456789
```

**Important Notes:**
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Don't share your API keys publicly
- Restart the dev server after changing environment variables

## Next Steps After Testing

Once local testing works:
1. Deploy to Vercel
2. Add the same environment variables in Vercel Dashboard → Project Settings → Environment Variables
3. Redeploy

