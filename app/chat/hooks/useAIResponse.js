"use client";
import { useCallback, useState } from 'react';

export const useAIResponse = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to create timeout signal with fallback
  const createTimeoutSignal = (timeoutMs) => {
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      return AbortSignal.timeout(timeoutMs);
    }
    // Fallback for older browsers
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  };

  const generateAIResponse = useCallback(async (
    prompt, 
    attachments = [], 
    previousMessages = [], 
    aiPreferences = null,
    messageCount = 0
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if message count exceeds limit
      if (aiPreferences?.numPrompts && messageCount >= aiPreferences.numPrompts) {
        return {
          response: `I apologize, but you've reached the maximum number of messages (${aiPreferences.numPrompts}) allowed for this session.`,
          limitReached: true,
          limitType: 'prompt',
          tokenUsage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
        };
      }

      // Calculate total tokens used so far if tracking is enabled
      let totalTokensUsed = 0;
      if (aiPreferences?.tokenPredictionLimit && previousMessages.length > 0) {
        // If previousMessages contains properly formatted messages with tokenUsage
        if (previousMessages[0].tokenUsage) {
          totalTokensUsed = previousMessages.reduce((sum, msg) => {
            return sum + (msg.tokenUsage?.total_tokens || 0);
          }, 0);
        }
        
        // If approaching token limit (>90%), warn the user
        if (totalTokensUsed > aiPreferences.tokenPredictionLimit * 0.9) {
          console.warn(`Approaching token limit: ${totalTokensUsed}/${aiPreferences.tokenPredictionLimit}`);
        }
        
        // If exceeding token limit, return error message
        if (totalTokensUsed >= aiPreferences.tokenPredictionLimit) {
          return {
            response: `I apologize, but you've reached the maximum token usage limit (${aiPreferences.tokenPredictionLimit}) for this session.`,
            limitReached: true,
            limitType: 'token',
            tokenUsage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
          };
        }
      }

      // Ensure history is properly formatted for the AI model
      const formattedHistory = Array.isArray(previousMessages) ? 
        previousMessages.map(msg => {
          // If it's already in the right format, use it directly
          if (msg.role && msg.content) return msg;
          
          // Otherwise, convert it to the correct format
          return {
            role: msg.isBot ? 'assistant' : 'user',
            content: msg.message || msg.text || msg.content || ''
          };
        }) : [];

      // Prepare the request body with AI preferences if available
      const requestBody = {
        // If prompt has attachments, explicitly include them in the main content
        prompt: attachments && attachments.length > 0 
          ? `${prompt}\n\nAttached document content:\n${attachments[0].content}`
          : prompt,
        attachments, // Still include the original attachments for reference
        history: formattedHistory,
        messageCount
      };

      // If we have AI preferences, add them to the request
      if (aiPreferences) {
        requestBody.preferences = aiPreferences;
      }      console.log("Sending AI request with history length:", formattedHistory.length);
      console.log("Message count:", messageCount, "Limit:", aiPreferences?.numPrompts || "unspecified");
      console.log("Token usage:", totalTokensUsed, "Limit:", aiPreferences?.tokenPredictionLimit || "unspecified");      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: createTimeoutSignal(18000), // 18 seconds total timeout (shorter than AI proxy)
      });// Handle different error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("AI proxy error:", response.status, errorData);
          // If this is potentially the first message (based on history length)
        if (formattedHistory.length === 0 || messageCount === 0) {
          console.log("First message failed, attempting retry...");
          // Wait briefly then retry
          await new Promise(resolve => setTimeout(resolve, 1500));
            const retryResponse = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: createTimeoutSignal(15000), // Shorter timeout for retry
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            // Handle error responses that still return 200 but contain error info
            if (retryData.isError) {
              return {
                response: retryData.response,
                tokenUsage: retryData.tokenUsage || {
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0
                },
                isError: true
              };
            }
            return retryData;
          }
        }
        
        let errorMessage = errorData.error || `HTTP ${response.status}: Failed to generate AI response`;
        setError(errorMessage);
          // Return a user-friendly fallback response
        const fallbackMessages = [
          "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
          "I'm currently unable to process your request. Please try rephrasing your question or try again later.",
          "There seems to be a connectivity issue. Please check your connection and try again.",
          "I'm temporarily unavailable due to high server load. Please try again shortly.",
          "The AI service is currently experiencing delays. Please try again in a few moments."
        ];
        
        const randomFallback = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        
        return {
          response: randomFallback,
          tokenUsage: {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0
          },
          isError: true
        };
      }

      const data = await response.json();
      
      // Handle error responses that still return 200 but contain error info
      if (data.isError) {
        setError(data.errorDetails?.message || 'AI service error');
        return {
          response: data.response,
          tokenUsage: data.tokenUsage || {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0
          },
          isError: true
        };
      }
      
      // Check if the new response would exceed the token limit
      if (aiPreferences?.tokenPredictionLimit && 
          (totalTokensUsed + (data.tokenUsage?.total_tokens || 0)) > aiPreferences.tokenPredictionLimit) {
        return {
          response: data.response,
          tokenUsage: data.tokenUsage || {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0
          },
          tokenLimitWarning: `You are now at ${totalTokensUsed + (data.tokenUsage?.total_tokens || 0)}/${aiPreferences.tokenPredictionLimit} tokens for this session.`
        };
      }
      
      return {
        response: data.response || 'I apologize, but I could not generate a response.',
        limitReached: data.limitReached || false,
        tokenUsage: data.tokenUsage || {
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0
        }
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      const errorMessage = error.message || "Failed to generate AI response";
      setError(errorMessage);
      
      return {
        response: `I apologize, but an error occurred: ${errorMessage}`,
        tokenUsage: {
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0
        }
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateAIResponseWithPreferences = async (message, sessionId, lectureId, previousMessages = [], messageCount = 0) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Log the parameters being used
      console.log("Generating AI response with:", { 
        message, 
        sessionId, 
        lectureId,
        messageCount,
        historyLength: previousMessages.length
      });
      
      // Fetch AI preferences first
      const preferencesResponse = await fetch(`/api/lectures/${lectureId}/preferences`);
      
      if (!preferencesResponse.ok) {
        const errorData = await preferencesResponse.json();
        console.error("Failed to fetch AI preferences:", errorData);
        throw new Error(`Failed to fetch AI preferences: ${errorData.error || preferencesResponse.statusText}`);
      }
      
      const preferences = await preferencesResponse.json();
      console.log("AI preferences fetched:", preferences);
      
      // Check message limits
      if (preferences.numPrompts && messageCount >= preferences.numPrompts) {
        return {
          response: `I apologize, but you've reached the maximum number of messages (${preferences.numPrompts}) allowed for this session.`,
          limitReached: true,
          limitType: 'prompt',
          tokenUsage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
        };
      }

      // Calculate total tokens used so far if tracking is enabled
      let totalTokensUsed = 0;
      if (preferences.tokenPredictionLimit && previousMessages.length > 0) {
        totalTokensUsed = previousMessages.reduce((sum, msg) => {
          return sum + (msg.tokenUsage?.total_tokens || 0);
        }, 0);
        
        // If exceeding token limit, return error message
        if (totalTokensUsed >= preferences.tokenPredictionLimit) {
          return {
            response: `I apologize, but you've reached the maximum token usage limit (${preferences.tokenPredictionLimit}) for this session.`,
            limitReached: true,
            limitType: 'token',
            tokenUsage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
          };
        }
      }

      // Format previous messages correctly for the API
      const formattedHistory = previousMessages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text || msg.content || msg.message || ''
      }));      // Now make the actual AI request with properly formatted message
      const aiResponse = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          preferences,
          history: formattedHistory,
          messageCount,
          messages: [
            { role: 'user', content: message }
          ]
        }),
        signal: createTimeoutSignal(25000), // 25 seconds timeout
      });
      
      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        console.error("AI response generation failed:", errorData);
        throw new Error(`AI response generation failed: ${errorData.error || aiResponse.statusText}`);
      }
      
      const data = await aiResponse.json();
      
      // Check if the new response would exceed the token limit
      if (preferences.tokenPredictionLimit && 
          (totalTokensUsed + (data.tokenUsage?.total_tokens || 0)) > preferences.tokenPredictionLimit) {
        return {
          response: data.response,
          tokenUsage: data.tokenUsage || {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0
          },
          tokenLimitWarning: `You are now at ${totalTokensUsed + (data.tokenUsage?.total_tokens || 0)}/${preferences.tokenPredictionLimit} tokens for this session.`
        };
      }
      
      return {
        response: data.response || 'I apologize, but I could not generate a response.',
        limitReached: data.limitReached || false,
        tokenUsage: data.tokenUsage || {
          total_tokens: 0, 
          prompt_tokens: 0,
          completion_tokens: 0
        },
        streaming: preferences.streaming || false
      };
    } catch (error) {
      console.error("Error in generateAIResponseWithPreferences:", error);
      setError(error.message || "Failed to generate AI response");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    generateAIResponse, 
    generateAIResponseWithPreferences, 
    isLoading, 
    error 
  };
};