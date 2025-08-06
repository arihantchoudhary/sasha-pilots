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

    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    // Format transcript for better context
    const formattedTranscript = transcript.map((turn: { role: string; message: string }) => 
      `${turn.role.toUpperCase()}: ${turn.message}`
    ).join('\n\n');

    const prompt = `Based on the following conversation transcript, please generate exactly 3 main takeaways from this conversation. Format your response as a simple numbered list.

TRANSCRIPT:
${formattedTranscript}

Please provide exactly 3 main takeaways in this format:
1. [First main takeaway]
2. [Second main takeaway] 
3. [Third main takeaway]

Keep each takeaway concise but informative, focusing on the most important points, decisions, or insights from the conversation.`;

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
          maxOutputTokens: 512,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated';
    
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}