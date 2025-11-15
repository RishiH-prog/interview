# Deploying to Vercel

This guide will help you deploy the Ankur AI Farmer Interview Platform to Vercel.

## Prerequisites

- A GitHub, GitLab, or Bitbucket account (for Dashboard deployment)
- An OpenAI API key
- Node.js installed locally (for CLI deployment)

## Method 1: Deploy via Vercel Dashboard (Recommended)

This is the easiest method and allows for automatic deployments on every push.

### Step 1: Push Code to GitHub

1. **Create a new GitHub repository** (if you haven't already):
   - Go to [GitHub](https://github.com/new)
   - Create a new repository (e.g., `ankur-farmer-interview`)
   - **Don't initialize with README** (if you already have code)

2. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Go to Vercel Dashboard**:
   - Visit [https://vercel.com](https://vercel.com)
   - Sign up or log in (you can use your GitHub account)

2. **Import your repository**:
   - Click "Add New..." → "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure the project**:
   - **Framework Preset**: Should auto-detect "Next.js"
   - **Root Directory**: Leave as `.` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: Leave as default
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add at least one transcription service API key:
     - **Name**: `ELEVENLABS_API_KEY` (RECOMMENDED for large files)
     - **Value**: Your ElevenLabs API key
     - **Environment**: Select all (Production, Preview, Development)
   - OR add fallback:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: Your OpenAI API key (starts with `sk-`)
     - **Environment**: Select all
   - (Optional) Add `DEEPGRAM_API_KEY` or `ASSEMBLYAI_API_KEY` for faster transcription
   - Click "Save"

5. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete (usually 1-2 minutes)
   - Your app will be live at `https://your-project-name.vercel.app`

### Step 3: Verify Deployment

1. Visit your deployment URL
2. Test the application:
   - Upload a guide
   - Create an interview with audio
   - Verify transcription works

## Method 2: Deploy via Vercel CLI

This method is useful for quick deployments without connecting to GitHub.

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This will open your browser to authenticate.

### Step 3: Deploy

From your project directory:

```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (for first deployment)
- **Project name?** → Enter a name or press Enter for default
- **Directory?** → Press Enter (default: `.`)

### Step 4: Add Environment Variables

After deployment, you need to add your OpenAI API key:

**Option A: Via Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add `OPENAI_API_KEY` with your key value

**Option B: Via CLI**
```bash
vercel env add OPENAI_API_KEY
```
Enter your API key when prompted.

### Step 5: Redeploy

After adding environment variables, redeploy:

```bash
vercel --prod
```

Or go to your project dashboard and click "Redeploy".

## Method 3: Deploy via GitHub Actions (Advanced)

If you want automated deployments on every push:

1. Your GitHub repository is already connected to Vercel (Method 1)
2. Vercel automatically deploys on every push to `main` branch
3. Pull requests get preview deployments automatically

## Environment Variables

### Required (at least one transcription service)

- `ELEVENLABS_API_KEY`: **RECOMMENDED** - ElevenLabs API key for large file transcription (best for Hindi audio)
- OR `OPENAI_API_KEY`: OpenAI API key for Whisper transcription and GPT translation/extraction (fallback)
- OR `DEEPGRAM_API_KEY`: Deepgram API key for fast transcription (smaller files)
- OR `ASSEMBLYAI_API_KEY`: AssemblyAI API key for fast transcription (alternative)

**Note**: You need at least one transcription service API key. ElevenLabs is recommended for large Hindi audio files as it automatically segments files >8 minutes for parallel processing.

### Optional (for faster/smaller file transcription)

- `DEEPGRAM_API_KEY`: For fastest transcription on smaller files
- `ASSEMBLYAI_API_KEY`: For fast alternative transcription
- `TRANSCRIPTION_LANGUAGE`: Language code for transcription (default: auto-detect)

## Troubleshooting

### Build Fails

1. **Check build logs** in Vercel Dashboard
2. **Common issues**:
   - Missing dependencies → Run `npm install` locally and commit `package-lock.json`
   - TypeScript errors → Fix linting errors
   - API route errors → Check `app/api/` files for syntax errors

### API Routes Not Working

1. **Ensure environment variables are set**:
   - Go to Project Settings → Environment Variables
   - Verify `OPENAI_API_KEY` is set for all environments

2. **Check API route files**:
   - Ensure files are in `app/api/` directory
   - Check file names match route paths

### Transcription Fails

1. **Verify API key**:
   - Check that `OPENAI_API_KEY` is correctly set in Vercel
   - Ensure the key has credits and is active

2. **Check API limits**:
   - Verify your OpenAI account has available credits
   - Check API rate limits

### Static Export Issues

If you see errors about static export:
- The app uses API routes (for transcription)
- Do NOT use `output: 'export'` in `next.config.js`
- Vercel automatically handles Next.js API routes

## Post-Deployment

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Monitoring

- View deployment logs in Vercel Dashboard
- Check function logs for API routes
- Monitor API usage in OpenAI dashboard

## Quick Reference

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (preview)
vercel

# Deploy (production)
vercel --prod

# Add environment variable
vercel env add OPENAI_API_KEY

# View logs
vercel logs
```

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Discord](https://vercel.com/discord)

