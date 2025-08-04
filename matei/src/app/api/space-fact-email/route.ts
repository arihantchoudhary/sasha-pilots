import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const emailRecipient = process.env.EMAIL_RECIPIENTS;
    const emailSubject = process.env.EMAIL_SUBJECT;
    
    if (!geminiApiKey || !mailgunApiKey || !emailRecipient) {
      return NextResponse.json(
        { error: 'Required API keys or email configuration not found' },
        { status: 500 }
      );
    }

    const { conversationId } = await request.json();

    // Generate space fact using Gemini
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Generate a fascinating space fact in 2-3 sentences about black holes, galaxies, or space exploration. Make it engaging and educational."
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 200,
        }
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API request failed: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const spaceFact = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'The universe is vast and full of wonders!';

    // Send email via Mailgun
    const timestamp = new Date().toLocaleString();
    const emailBody = `Here's your fascinating space fact:

${spaceFact}

This email was triggered by a conversation interaction (ID: ${conversationId}) at ${timestamp}.

Sent with love from Arihant's automated system! 🚀`;

    const formData = new FormData();
    formData.append('from', 'Arihant\'s Agent <arihant@ai.complete.city>');
    formData.append('to', emailRecipient);
    formData.append('subject', emailSubject || '🌌 Your Space Fact');
    formData.append('text', emailBody);

    const mailgunResponse = await fetch('https://api.mailgun.net/v3/ai.complete.city/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`,
      },
      body: formData,
    });

    if (!mailgunResponse.ok) {
      throw new Error(`Mailgun API request failed: ${mailgunResponse.status}`);
    }

    return NextResponse.json({ 
      success: true, 
      spaceFact,
      recipient: emailRecipient 
    });
  } catch (error) {
    console.error('Error sending space fact email:', error);
    return NextResponse.json(
      { error: 'Failed to send space fact email' },
      { status: 500 }
    );
  }
}