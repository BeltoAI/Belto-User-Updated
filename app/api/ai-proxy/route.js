import { NextResponse } from 'next/server';
import axios from 'axios';

const endpoints = [
  'http://47.34.185.47:9999/v1/chat/completions',
  'http://belto.myftp.biz:9999/v1/chat/completions'
];

// 'http://97.90.195.162:9999/v1/chat/completions',

// Endpoint health tracking instead of simple round-robin
const endpointStats = endpoints.map(url => ({
  url,
  isAvailable: true,
  failCount: 0,
  lastResponseTime: 0,
  lastChecked: Date.now(),
  consecutiveFailures: 0
}));

const TIMEOUT_MS = 15000; // 15 seconds timeout (optimized for Vercel free tier)
const MAX_CONSECUTIVE_FAILURES = 2; // Number of failures before marking endpoint as unavailable
const RETRY_INTERVAL_MS = 15000; // Try unavailable endpoints again after 15 seconds
const HEALTH_CHECK_THRESHOLD = 60000; // 1 minute for faster response (Vercel optimized)

/**
 * Selects the best endpoint based on availability and response time
 * @returns {string} The URL of the selected endpoint
 */
function selectEndpoint() {
  const now = Date.now();
  
  // First, check if any unavailable endpoints should be retried
  endpointStats.forEach(endpoint => {
    if (!endpoint.isAvailable && (now - endpoint.lastChecked) > RETRY_INTERVAL_MS) {
      console.log(`Marking ${endpoint.url} as available for retry`);
      endpoint.isAvailable = true;
      endpoint.failCount = 0;
      endpoint.consecutiveFailures = 0;
    }
  });

  // Filter for available endpoints
  const availableEndpoints = endpointStats.filter(endpoint => endpoint.isAvailable);
  
  if (availableEndpoints.length === 0) {
    // All endpoints are unavailable, reset the first one for retry
    console.log('All endpoints unavailable, resetting the first one for retry');
    endpointStats[0].isAvailable = true;
    endpointStats[0].failCount = 0;
    endpointStats[0].consecutiveFailures = 0;
    return endpointStats[0].url;
  }
  
  // Choose the fastest available endpoint with the least recent activity
  availableEndpoints.sort((a, b) => {
    // Prioritize endpoints with faster response times
    if (a.lastResponseTime !== b.lastResponseTime) {
      return a.lastResponseTime - b.lastResponseTime;
    }
    // If response times are similar, choose the one that hasn't been used recently
    return a.lastChecked - b.lastChecked;
  });
  
  return availableEndpoints[0].url;
}

/**
 * Updates endpoint statistics after a request
 * @param {string} url - The endpoint URL
 * @param {boolean} success - Whether the request was successful
 * @param {number} responseTime - The time taken for the response
 */
function updateEndpointStats(url, success, responseTime) {
  const endpoint = endpointStats.find(e => e.url === url);
  if (!endpoint) return;
  
  endpoint.lastChecked = Date.now();
  
  if (success) {
    endpoint.isAvailable = true;
    endpoint.lastResponseTime = responseTime;
    endpoint.consecutiveFailures = 0;
    // Gradually reduce fail count on success
    if (endpoint.failCount > 0) {
      endpoint.failCount = Math.max(0, endpoint.failCount - 1);
    }
  } else {
    endpoint.failCount++;
    endpoint.consecutiveFailures++;
    
    if (endpoint.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`Marking ${url} as unavailable after ${endpoint.consecutiveFailures} consecutive failures`);
      endpoint.isAvailable = false;
    }
  }
}

/**
 * Performs a health check on all endpoints
 */
async function healthCheck() {
  console.log('Performing health check on all endpoints');
  
  const checks = endpoints.map(async (url) => {
    const endpoint = endpointStats.find(e => e.url === url);
    if (!endpoint) return;
    
    try {
      const startTime = Date.now();      // Use a simple connectivity test with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced to 2 seconds
      
      await fetch(url.replace('/chat/completions', ''), {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 
          'Content-Type': 'application/json' 
        }
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      updateEndpointStats(url, true, responseTime);
      console.log(`Health check for ${url}: OK (${responseTime}ms)`);
    } catch (error) {
      console.log(`Health check for ${url}: FAILED - ${error.message}`);
      updateEndpointStats(url, false, 0);
    }
  });
  
  await Promise.allSettled(checks);
}

// Periodically check endpoints health - only in serverless environment when needed
let healthCheckInterval = null;

// Initialize health checking if not already running
function initializeHealthCheck() {
  if (!healthCheckInterval && typeof setInterval !== 'undefined') {
    healthCheckInterval = setInterval(() => {
      const now = Date.now();
      // Only perform health check if enough time has passed since the last check
      const needsCheck = endpointStats.some(
        endpoint => now - endpoint.lastChecked > HEALTH_CHECK_THRESHOLD
      );
      
      if (needsCheck) {
        healthCheck().catch(error => {
          console.error('Health check failed:', error);
        });
      }
    }, HEALTH_CHECK_THRESHOLD / 2); // Check twice as often as the threshold
  }
}

// Initialize on module load
initializeHealthCheck();

export async function POST(request) {
  console.log('POST request received to AI proxy');

  try {
    const body = await request.json();
    console.log('Request body structure:', Object.keys(body));

    // Get API key from environment variables
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      console.error('AI API key is not configured');
      return NextResponse.json(
        { error: 'AI API key is not configured on the server' },
        { status: 500 }
      );
    }

    // Initialize messages array
    let messages = [];
   
    // Include conversation history if provided
    if (body.history && Array.isArray(body.history) && body.history.length > 0) {
      console.log('Using provided conversation history, length:', body.history.length);
      messages = [...body.history];
    }

    // Handle different request formats - both from generateAIResponse and generateAIResponseWithPreferences
    if (body.messages && Array.isArray(body.messages)) {
      // Direct message array format - append to any existing history
      if (messages.length === 0) {
        messages = body.messages;
      } else {
        // Only add messages that aren't duplicates in the history
        body.messages.forEach(newMsg => {
          const isDuplicate = messages.some(existingMsg =>
            existingMsg.role === newMsg.role &&
            existingMsg.content === newMsg.content
          );
          if (!isDuplicate) {
            messages.push(newMsg);
          }
        });
      }
    }
   
    // Add the current prompt/message if it's not already in the history
    if (body.prompt) {
      const newUserMessage = { role: 'user', content: body.prompt };
      const isDuplicate = messages.some(existingMsg =>
        existingMsg.role === 'user' &&
        existingMsg.content === body.prompt
      );
      if (!isDuplicate) {
        messages.push(newUserMessage);
      }
    } else if (body.message) {
      const newUserMessage = { role: 'user', content: body.message };
      const isDuplicate = messages.some(existingMsg =>
        existingMsg.role === 'user' &&
        existingMsg.content === body.message
      );
      if (!isDuplicate) {
        messages.push(newUserMessage);
      }
    }

    // Make sure all messages have the required 'content' field
    messages = messages.map(msg => {
      if (!msg.content && msg.message) {
        return { ...msg, content: msg.message };
      }
      return msg;
    });

    // Add system message if preferences contains it
    let systemMessageAdded = false;
   
    if (body.preferences?.systemPrompts && body.preferences.systemPrompts.length > 0) {
      messages.unshift({
        role: 'system',
        content: body.preferences.systemPrompts[0].content
      });
      systemMessageAdded = true;
    } else if (body.aiConfig?.systemPrompts && body.aiConfig.systemPrompts.length > 0) {
      messages.unshift({
        role: 'system',
        content: body.aiConfig.systemPrompts[0].content
      });
      systemMessageAdded = true;
    }
   
    // Add default system message if none provided
    if (!systemMessageAdded) {
      messages.unshift({
        role: 'system',
        content: 'You are a helpful AI assistant named BELTO. Use previous conversation history to maintain context.'
      });
    }

    // Ensure each message has content and remove any empty messages
    const validMessages = messages.filter(msg => msg.content);
   
    if (validMessages.length === 0) {
      return NextResponse.json(
        { error: "No valid messages with content provided" },
        { status: 400 }
      );
    }

    console.log('Final message count being sent to AI:', validMessages.length);

    // Prepare the request payload based on the expected format
    const aiRequestPayload = {
      model: body.aiConfig?.model || body.preferences?.model || 'default-model',
      messages: validMessages,
      temperature: body.aiConfig?.temperature || body.preferences?.temperature || 0.7,
      max_tokens: body.aiConfig?.maxTokens || body.preferences?.maxTokens || 500,
    };

    console.log('Request payload structure:', Object.keys(aiRequestPayload));
    console.log('Message count:', aiRequestPayload.messages.length);    // Try multiple endpoints if needed
    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = Math.min(2, endpoints.length); // Reduced to 2 attempts for faster response
    
    while (attemptCount < maxAttempts) {
      attemptCount++;
      
      try {
        // Select the best endpoint using our load balancing algorithm
        const selectedEndpoint = selectEndpoint();
        console.log(`Attempt ${attemptCount}: Selected endpoint ${selectedEndpoint}`);
        
        // Start timing the request for performance tracking
        const requestStartTime = Date.now();

        // Create abort controller for manual timeout control
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log(`Request timeout after ${TIMEOUT_MS}ms for ${selectedEndpoint}`);
        }, TIMEOUT_MS);

        // Make the AI API call with API key in headers
        const response = await axios.post(
          selectedEndpoint,
          aiRequestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            timeout: TIMEOUT_MS,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Calculate response time and update endpoint stats for success
        const responseTime = Date.now() - requestStartTime;
        updateEndpointStats(selectedEndpoint, true, responseTime);

        console.log(`AI response received with status: ${response.status}, time: ${responseTime}ms`);

        return NextResponse.json({
          response: response.data.choices?.[0]?.message?.content || 'No response content',
          tokenUsage: response.data.usage || {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0
          }
        });
        
      } catch (error) {
        lastError = error;
        
        // Update endpoint stats for failures
        if (error.config?.url) {
          updateEndpointStats(error.config.url, false, 0);
          console.log(`Attempt ${attemptCount} failed for ${error.config.url}: ${error.message}`);
        }
        
        // If this isn't the last attempt, wait briefly before retrying
        if (attemptCount < maxAttempts) {
          console.log(`Retrying in 500ms... (attempt ${attemptCount + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // If all attempts failed, throw the last error to be handled by the outer catch block
    throw lastError;  } catch (error) {
    // Log detailed error information
    console.error('AI API Error after all attempts:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
      url: error.config?.url,
      attempts: error.attempts || 'unknown'
    });    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to generate AI response';
    let statusCode = 500;
    let fallbackResponse = null;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || 
        error.code === 'ETIMEDOUT' || error.name === 'AbortError' ||
        (error.response?.status >= 504 && error.response?.status <= 599)) {
      errorMessage = 'AI service is temporarily unavailable due to timeout or connectivity issues.';
      statusCode = 503; // Service Unavailable
      fallbackResponse = "I apologize, but I'm currently experiencing connectivity issues. The AI service is taking longer than expected to respond. Please try sending your message again in a moment.";
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication issue with AI service.';
      statusCode = 500;
      fallbackResponse = "I'm experiencing authentication issues. Please contact support if this continues.";
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid request format.';
      statusCode = 400;
      fallbackResponse = "I had trouble understanding your request. Could you please rephrase it?";
    } else if (error.response?.status === 429) {
      errorMessage = 'AI service rate limit exceeded.';
      statusCode = 429;
      fallbackResponse = "I'm currently handling many requests. Please wait a moment and try again.";
    } else if (error.response?.status === 504) {
      errorMessage = 'AI service gateway timeout. The request took too long to process.';
      statusCode = 504;
      fallbackResponse = "Your request is taking longer than expected to process. This might be due to high server load. Please try again with a shorter message or wait a moment before retrying.";
    } else if (error.response?.data?.error) {
      errorMessage = `AI service error: ${error.response.data.error.message || 'Unknown error'}`;
      fallbackResponse = "I encountered an unexpected error while processing your request. Please try again.";    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timeout - AI service took too long to respond.';
      statusCode = 504;
      fallbackResponse = "I apologize, but I'm currently experiencing connectivity issues. The AI service is taking longer than expected to respond. Please try sending your message again in a moment.";
    }

    // Return a user-friendly response instead of just an error
    return NextResponse.json({
      response: fallbackResponse || "I apologize, but I'm unable to process your request right now. Please try again later.",
      tokenUsage: {
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0
      },
      isError: true,
      errorDetails: {
        message: errorMessage,
        code: error.code,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 }); // Return 200 so the chat doesn't break, but include error info
  }
}

export async function GET(request) {
  try {
    console.log('Health check request to AI proxy');
    
    // Quick health check of endpoints
    const healthResults = await Promise.allSettled(
      endpoints.map(async (url) => {
        const endpoint = endpointStats.find(e => e.url === url);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch(url.replace('/chat/completions', ''), {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          return {
            url,
            status: 'available',
            responseTime: endpoint?.lastResponseTime || 0,
            consecutiveFailures: endpoint?.consecutiveFailures || 0
          };
        } catch (error) {
          return {
            url,
            status: 'unavailable',
            error: error.message,
            consecutiveFailures: endpoint?.consecutiveFailures || 0
          };
        }
      })
    );    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: healthResults.map(result => result.value || result.reason),
      availableEndpoints: healthResults.filter(result => 
        (result.value || result.reason)?.status === 'available'
      ).length,
      totalEndpoints: endpoints.length
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return NextResponse.json({}, { status: 200 });
}