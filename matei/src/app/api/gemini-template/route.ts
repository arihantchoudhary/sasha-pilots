import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { discussionContent } = await request.json();
    
    if (!discussionContent) {
      return NextResponse.json({ error: 'Discussion content is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{
          text: `Please analyze and provide additional insights for this One-on-One Prep Discussion:

${discussionContent}

Provide detailed next steps, potential challenges, and recommendations for implementation. Format your response in a structured way with clear sections.`
        }]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const geminiResponse = result.candidates[0].content.parts[0].text;

    return NextResponse.json({ analysis: geminiResponse });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}