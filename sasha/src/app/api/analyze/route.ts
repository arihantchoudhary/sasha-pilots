import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const { transcript, question } = await request.json();

    if (!transcript || !question) {
      return NextResponse.json(
        { error: 'Transcript and question are required' },
        { status: 400 }
      );
    }

    // Format transcript for better context
    const formattedTranscript = transcript.map((turn: { role: string; message: string }) => 
      `${turn.role.toUpperCase()}: ${turn.message}`
    ).join('\n\n');

    const prompt = `Based on the following conversation transcript, please answer the user's question accurately and concisely.

TRANSCRIPT:
${formattedTranscript}

QUESTION: ${question}

Please provide a helpful answer based only on the information available in the transcript above.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated';
    
    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transcript' },
      { status: 500 }
    );
  }
}