import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.log('Testing AI proxy...');
    
    const testPayload = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' }
      ],
      model: 'default-model',
      temperature: 0.7,
      max_tokens: 50
    };

    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      aiProxyStatus: response.status,
      aiProxyResponse: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test AI error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
