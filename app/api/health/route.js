import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const startTime = Date.now();
    
    // Test AI proxy health
    const aiProxyResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai-proxy`, {
      method: 'GET',
    });
    
    const aiProxyData = await aiProxyResponse.json();
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: responseTime,
      services: {
        aiProxy: {
          status: aiProxyResponse.ok ? 'healthy' : 'unhealthy',
          availableEndpoints: aiProxyData.availableEndpoints || 0,
          totalEndpoints: aiProxyData.totalEndpoints || 0,
          details: aiProxyData
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || 'unknown'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
