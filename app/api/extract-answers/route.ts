import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { transcript, questions } = await request.json();

    if (!transcript || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Transcript and questions array are required' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Please set it in your environment variables.' },
        { status: 500 }
      );
    }

    // Build prompt for GPT
    const questionsText = questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n');
    
    const prompt = `You are an assistant that extracts answers from interview transcripts.

TRANSCRIPT:
${transcript}

QUESTIONS:
${questionsText}

Based on the transcript above, extract the answer for each question. If an answer is not found in the transcript, write "[No answer found in transcript]". 

For each answer, provide:
1. The extracted answer (a clear, concise summary)
2. A direct quote from the transcript that supports this answer (if available)
3. Brief reasoning explaining why this answer was extracted for this question

Return a JSON object with an "answers" key containing an array of objects. Each object must have:
- "question": The question text
- "answer": The extracted answer
- "quote": A direct quote from the transcript that supports the answer (optional, use null if not found)
- "reasoning": A brief explanation of why this answer was extracted (1-2 sentences)

Example format:
{
  "answers": [
    {
      "question": "Question 1 text",
      "answer": "Extracted answer from transcript",
      "quote": "Direct quote from transcript that supports this answer",
      "reasoning": "This answer was extracted because the transcript mentions..."
    },
    {
      "question": "Question 2 text",
      "answer": "Extracted answer from transcript",
      "quote": null,
      "reasoning": "This answer was inferred from the context..."
    }
  ]
}

Return ONLY valid JSON, no other text.`;

    // Call OpenAI GPT API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5', // Using GPT-5 for translation and answer extraction
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured answers from interview transcripts. Always return valid JSON arrays.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        // GPT-5 only supports default temperature (1), cannot set custom values
        response_format: { type: 'json_object' }, // Force JSON object response
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.error?.message || 'Answer extraction failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from GPT' },
        { status: 500 }
      );
    }

    // Parse JSON response
    type AnswerObject = {
      question?: string;
      answer: string;
      quote?: string | null;
      reasoning?: string | null;
    };
    
    let answers: AnswerObject[] = [];
    try {
      // Try to parse as JSON object first (if GPT wrapped it)
      const parsed = JSON.parse(content);
      // If it's an object with an answers key, extract it
      if (parsed.answers && Array.isArray(parsed.answers)) {
        answers = parsed.answers;
      } else if (Array.isArray(parsed)) {
        answers = parsed;
      } else {
        // If it's a single object, try to find array
        const possibleKeys = Object.keys(parsed);
        if (possibleKeys.length > 0 && Array.isArray(parsed[possibleKeys[0]])) {
          answers = parsed[possibleKeys[0]];
        } else {
          throw new Error('Unexpected JSON structure');
        }
      }
    } catch (parseError) {
      // Fallback: try to extract JSON array from text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        answers = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse GPT response as JSON');
      }
    }

    // Validate and ensure we have answers for all questions
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      // If GPT didn't return the right number, create fallback answers
      const existingAnswers = answers;
      answers = questions.map((question: string, index: number): AnswerObject => {
        const found = existingAnswers.find((a: AnswerObject) => a.question === question || a.question?.includes(question.substring(0, 20)));
        return {
          question,
          answer: found?.answer || '[Could not extract answer from transcript]',
          quote: found?.quote || null,
          reasoning: found?.reasoning || null,
        };
      });
    }

    // Ensure all answers have the correct question format
    const finalAnswers = questions.map((question: string, index: number) => {
      const answerObj = answers[index] || answers.find((a: AnswerObject) => 
        a.question === question || 
        a.question?.toLowerCase().includes(question.toLowerCase().substring(0, 20))
      );
      return {
        question,
        answer: answerObj?.answer || '[Could not extract answer from transcript]',
        quote: answerObj?.quote || null,
        reasoning: answerObj?.reasoning || null,
      };
    });

    return NextResponse.json({
      answers: finalAnswers,
    });
  } catch (error) {
    console.error('Answer extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

