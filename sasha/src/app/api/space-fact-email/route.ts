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

    const { conversationId, recipient } = await request.json();

    // Get conversation details first
    const conversationResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/conversations/${conversationId}`);
    if (!conversationResponse.ok) {
      throw new Error('Failed to fetch conversation details');
    }
    
    const conversationDetails = await conversationResponse.json();
    
    // Generate summary using existing endpoint
    const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript: conversationDetails.transcript }),
    });

    if (!summaryResponse.ok) {
      throw new Error(`Summary generation failed: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.summary || 'Unable to generate meeting agenda at this time.';

    // Send email via Mailgun
    const emailBody = `Dear ${recipient},

I hope this email finds you well! Here are some ideas that I wanted to share about talking to you in our meeting:

${summary}

Looking forward to our discussion!

Best regards,
Sasha

---
Meeting prep from conversation on ${new Date().toLocaleDateString()}`;

    const formData = new FormData();
    formData.append('from', 'Sasha <arihant@ai.complete.city>');
    formData.append('to', recipient || emailRecipient);
    formData.append('subject', 'Agenda for Our Upcoming Meeting');
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
      summary,
      recipient: recipient || emailRecipient 
    });
  } catch (error) {
    console.error('Error sending meeting agenda email:', error);
    return NextResponse.json(
      { error: 'Failed to send meeting agenda email' },
      { status: 500 }
    );
  }
}