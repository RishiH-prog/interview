# Project Ankur — AI Farmer Interview Platform (v0)

A single-page web application for managing AI-assisted farmer interviews. Built with Next.js, React, and Tailwind CSS, with all data stored in browser localStorage.

## Features

### Admin Features
- **Upload Interview Guides**: Upload `.txt` files containing interview questions
- **Manage Guides**: Toggle active/inactive status, delete guides
- **View All Interviews**: View all interviews with sorting capabilities
- **Download Interviews**: Download interview summaries as `.txt` files

### Employee Features
- **Create Interviews**: Select from active guides and create new interviews
- **Edit Interviews**: Edit interview answers, save as draft, or approve
- **View Interview Status**: Track interview status (Draft, AI-generated, Approved)

## Tech Stack

- **Next.js 14** - React framework with API routes
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **OpenAI Whisper API** - Audio transcription
- **localStorage** - Data persistence (no backend database required)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- OpenAI API key (for audio transcription)

### API Key Setup

This application uses **OpenAI Whisper API** for audio transcription.

1. **Get your OpenAI API key**:
   - Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Sign up or log in to your OpenAI account
   - Create a new API key

2. **Set up environment variable**:
   - Create a `.env.local` file in the root directory
   - Add your API key:
     ```
     OPENAI_API_KEY=sk-your-api-key-here
     ```
   - Optional: Set transcription language (e.g., `TRANSCRIPTION_LANGUAGE=en` or `hi` for Hindi)
   
   **Important**: Never commit your `.env.local` file to version control!

3. **For Vercel deployment**:
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add `OPENAI_API_KEY` with your API key value
   - Redeploy your application

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file with your OpenAI API key (see above)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment to Vercel

This project is configured for direct deployment to Vercel. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Quick Start

**Method 1: Vercel Dashboard (Recommended)**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project" and import your repository
4. Add environment variable: `OPENAI_API_KEY` (your OpenAI API key)
5. Click "Deploy"

**Method 2: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variable
vercel env add OPENAI_API_KEY

# Deploy to production
vercel --prod
```

### Important: Environment Variables

**Required**: Add `OPENAI_API_KEY` in Vercel project settings:
- Go to Project → Settings → Environment Variables
- Add `OPENAI_API_KEY` with your OpenAI API key
- Select all environments (Production, Preview, Development)
- Redeploy after adding the variable

For complete deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Project Structure

```
├── app/
│   ├── globals.css          # Global styles and Tailwind imports
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main application page
├── components/
│   ├── InterviewModal.tsx   # Modal for editing interviews
│   └── Toast.tsx            # Toast notification component
├── lib/
│   ├── storage.ts           # localStorage utilities
│   └── utils.ts             # Helper functions
├── next.config.js           # Next.js configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── package.json             # Dependencies and scripts
```

## Data Model

### Guides
Stored in `localStorage` under key `ankur_guides`:
```typescript
{
  id: string;
  name: string;
  questions: string[];
  active: boolean;
}
```

### Interviews
Stored in `localStorage` under key `ankur_interviews`:
```typescript
{
  id: string;
  guideId: string;
  guideName: string;
  interviewer: string;
  date: string;
  village: string;
  farmerName: string;
  audioFile: string;
  status: 'Draft' | 'AI-generated' | 'Approved';
  answers: Array<{ question: string; answer: string }>;
}
```

## Usage

### Uploading an Interview Guide

1. Navigate to the "Upload Interview Guide (Admin)" section
2. Click "Choose File" and select a `.txt` file
3. The file should contain questions, one per line, or numbered format:
   ```
   Question 1: How long have you been farming?
   Question 2: What crops do you grow each season?
   ```
4. The guide will be automatically parsed and saved

### Creating an Interview

1. Go to "Add Interview (Employee)" section
2. Select an active guide from the dropdown
3. Fill in all required fields:
   - Interviewer Name
   - Date
   - Village / District
   - Farmer ID / Name
4. **Upload an audio file** (required):
   - Supported formats: MP3, WAV, M4A, etc.
   - The system will automatically transcribe the audio using OpenAI Whisper
   - Answers will be extracted from the transcription and matched to questions
5. Click "Create Interview"
6. The system will:
   - Transcribe the audio file
   - Parse the transcription to extract answers for each question
   - Auto-fill the interview with the transcribed answers
   - If transcription fails, it will fall back to Lorem Ipsum answers

### Editing an Interview

1. Click on any interview row in the "Edit Interviews" table
2. A modal will open showing all questions and answers
3. Edit answers as needed
4. Click "Save Draft" to save changes
5. Click "Approve & Submit" to lock the interview (status becomes "Approved")

### Downloading Interview Summaries

1. In the "All Interviews (Admin View)" section
2. Click "Download" next to any interview
3. A formatted `.txt` file will download to your browser

## Notes

- **Data Storage**: Currently uses browser localStorage (device-specific)
  - Data persists on the same device/browser
  - **Data does NOT sync across devices** (phone vs laptop have separate storage)
  - To enable cross-device sync, see [DATABASE_SETUP.md](./DATABASE_SETUP.md) for database setup
- **Audio transcription** uses OpenAI Whisper API and requires an API key
- **Hindi audio** is transcribed to Hindi text and translated to English
- **Both transcripts are saved** (Hindi and English) for reference
- **Answer extraction** uses GPT-4o-mini to intelligently extract answers from the English transcript
- All processing is done server-side via Next.js API routes for security
- Answers can always be edited (except transcripts which are read-only)
- Multiple guides can be active simultaneously
- This is a v0 prototype designed for demonstration purposes

## Audio Transcription & Translation

The application uses OpenAI Whisper API and GPT to process Hindi audio interviews. The complete process:

1. **Upload**: User uploads a Hindi audio file (MP3, WAV, M4A, etc.)
2. **Hindi Transcription**: Audio is transcribed to Hindi text using Whisper API (language='hi')
3. **English Translation**: Audio is translated to English using Whisper Translations API
4. **Answer Extraction**: GPT-4o-mini analyzes the English transcript and extracts answers for each question
5. **Auto-fill**: Answers are automatically populated in the interview form
6. **Both transcripts are saved** for reference (Hindi and English)

### Workflow

- **Hindi Audio** → **Whisper (Hindi)** → **Hindi Transcript** (saved)
- **Hindi Audio** → **Whisper Translations** → **English Transcript** (saved)
- **English Transcript** → **GPT-4o-mini** → **Extracted Answers** (auto-filled)

**Cost Note**: 
- OpenAI Whisper API charges based on audio duration (~$0.006 per minute)
- GPT-4o-mini charges per token (~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens)
- Check [OpenAI Pricing](https://openai.com/pricing) for current rates.

## Future Enhancements

- Backend API integration
- Real audio processing
- User authentication
- Database persistence
- Export to multiple formats (PDF, CSV, etc.)
- Advanced search and filtering

## License

This project is a prototype for demonstration purposes.

