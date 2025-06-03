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

const TIMEOUT_MS = 12000; // 12 seconds timeout (optimized for Vercel free tier)
const FILE_SUMMARIZATION_TIMEOUT_MS = 45000; // 45 seconds for file summarization requests
const LARGE_CONTENT_TIMEOUT_MS = 30000; // 30 seconds for requests with large content
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

/**
 * Determines if the request is a file summarization request and returns appropriate timeout
 * @param {Object} body - The request body
 * @returns {Object} Timeout configuration with timeout value and request type
 */
function determineRequestTimeout(body) {
  const requestInfo = {
    timeout: TIMEOUT_MS,
    type: 'regular',
    reason: 'Standard AI request'
  };

  // Check for file attachments in various formats
  const hasAttachments = body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0;
  const hasAttachmentsInPrompt = body.prompt && body.prompt.includes('Attached document content:');
  const hasAttachmentsInMessage = body.message && body.message.includes('document content to analyze:');
  
  // Check for RAG context (lecture materials)
  const hasRAGContext = body.lectureId && body.authToken;
  
  // Calculate total content length
  let totalContentLength = 0;
  if (body.prompt) totalContentLength += body.prompt.length;
  if (body.message) totalContentLength += body.message.length;
  if (body.messages && Array.isArray(body.messages)) {
    totalContentLength += body.messages.reduce((total, msg) => total + (msg.content?.length || 0), 0);
  }
  if (body.history && Array.isArray(body.history)) {
    totalContentLength += body.history.reduce((total, msg) => total + (msg.content?.length || 0), 0);
  }

  // Detect file summarization scenarios (highest priority timeout)
  if (hasAttachments || hasAttachmentsInPrompt || hasAttachmentsInMessage) {
    requestInfo.timeout = FILE_SUMMARIZATION_TIMEOUT_MS;
    requestInfo.type = 'file_summarization';
    requestInfo.reason = 'Request contains file attachments for summarization';
    console.log(`File summarization detected - using ${FILE_SUMMARIZATION_TIMEOUT_MS}ms timeout`);
  }
  // Detect RAG requests with potential large context
  else if (hasRAGContext) {
    requestInfo.timeout = LARGE_CONTENT_TIMEOUT_MS;
    requestInfo.type = 'rag_enhanced';
    requestInfo.reason = 'Request includes RAG context from lecture materials';
    console.log(`RAG-enhanced request detected - using ${LARGE_CONTENT_TIMEOUT_MS}ms timeout`);
  }
  // Detect large content requests
  else if (totalContentLength > 5000) {
    requestInfo.timeout = LARGE_CONTENT_TIMEOUT_MS;
    requestInfo.type = 'large_content';
    requestInfo.reason = `Request has large content (${totalContentLength} chars)`;
    console.log(`Large content detected (${totalContentLength} chars) - using ${LARGE_CONTENT_TIMEOUT_MS}ms timeout`);
  }

  return requestInfo;
}

/**
 * Fetches chat context (lecture attachments) for RAG enhancement
 * @param {string} lectureId - The lecture ID to fetch context for
 * @param {string} authToken - JWT token for authentication
 * @param {Request} request - The original request object to get the origin
 * @param {number} timeout - Timeout in milliseconds (default 5000)
 * @returns {Promise<Object|null>} Chat context data or null if failed
 */
async function fetchChatContext(lectureId, authToken, request, timeout = 5000) {
  if (!lectureId || !authToken) {
    return null;
  }

  try {
    // Use the current request's origin for internal API calls
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Create timeout for RAG context fetch with configurable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    console.log(`Fetching RAG context with ${timeout}ms timeout for lecture: ${lectureId}`);
    
    const response = await fetch(`${baseUrl}/api/chat-context?lectureId=${lectureId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`Failed to fetch chat context: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`RAG context fetch timed out after ${timeout}ms - continuing without context`);
    } else {
      console.log(`Error fetching chat context: ${error.message}`);
    }
    return null;
  }
}

export async function POST(request) {
  console.log('POST request received to AI proxy');

  try {
    const body = await request.json();
    console.log('Request body structure:', Object.keys(body));

    // Determine request type and appropriate timeout
    const requestConfig = determineRequestTimeout(body);
    console.log(`Request type: ${requestConfig.type}, Timeout: ${requestConfig.timeout}ms, Reason: ${requestConfig.reason}`);

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
    }    // Make sure all messages have the required 'content' field
    messages = messages.map(msg => {
      if (!msg.content && msg.message) {
        return { ...msg, content: msg.message };
      }
      return msg;
    });    // Fetch RAG context if lectureId and authToken are provided
    let ragContext = null;
    if (body.lectureId && body.authToken) {
      console.log(`Fetching RAG context for lecture: ${body.lectureId}`);
      // Use longer timeout for file summarization and large content requests
      const ragTimeout = requestConfig.type === 'file_summarization' ? 10000 : 
                        requestConfig.type === 'large_content' ? 8000 : 5000;
      ragContext = await fetchChatContext(body.lectureId, body.authToken, request, ragTimeout);
      if (ragContext) {
        console.log(`RAG context fetched: ${ragContext.lectureTitle}, ${ragContext.attachments?.length || 0} attachments`);
      }
    }// Add system message if preferences contains it
    let systemMessageAdded = false;
    let baseSystemPrompt = '';
   
    if (body.preferences?.systemPrompts && body.preferences.systemPrompts.length > 0) {
      baseSystemPrompt = body.preferences.systemPrompts[0].content;
    } else if (body.aiConfig?.systemPrompts && body.aiConfig.systemPrompts.length > 0) {
      baseSystemPrompt = body.aiConfig.systemPrompts[0].content;
    } else {
      baseSystemPrompt = 'You are a helpful AI assistant named BELTO. Use previous conversation history to maintain context.';
    }    // Enhance system prompt with RAG context if available
    if (ragContext && ragContext.attachments && ragContext.attachments.length > 0) {
      // Limit context to prevent token overflow - max 2000 characters per attachment
      const maxContextPerAttachment = 2000;
      const contextContent = ragContext.attachments
        .slice(0, 3) // Limit to 3 attachments maximum
        .map(att => {
          const truncatedContent = att.content.length > maxContextPerAttachment 
            ? att.content.substring(0, maxContextPerAttachment) + '...[truncated]'
            : att.content;
          return `Document: ${att.name}\nContent: ${truncatedContent}`;
        })
        .join('\n\n');
      
      baseSystemPrompt += `\n\nYou have access to the following course materials from "${ragContext.lectureTitle}" (Lecture ID: ${ragContext.lectureId}):\n\n${contextContent}\n\nWhen answering questions, prioritize information from these course materials when relevant. If your response includes information from these materials, briefly mention which document you're referencing.`;
    }

    messages.unshift({
      role: 'system',
      content: baseSystemPrompt
    });

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

        // Create abort controller for manual timeout control with dynamic timeout
        const dynamicTimeout = requestConfig.timeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log(`Request timeout after ${dynamicTimeout}ms for ${selectedEndpoint} (${requestConfig.type} request)`);
        }, dynamicTimeout);

        // Make the AI API call with API key in headers
        const response = await axios.post(
          selectedEndpoint,
          aiRequestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            timeout: dynamicTimeout,
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