"use client";

import { useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAIResponse } from './useAIResponse';
import { 
  searchLectureMaterials, 
  shouldTriggerSemanticSearch, 
  formatSemanticResults 
} from '../utils/semanticSearch';

// Update the function signature to accept lectureMaterials and lectureId
export const useChatHandlers = (
  userId,
  currentSessionId,
  messages,
  setMessages,
  setIsGenerating,
  updateTokenUsage,
  clearInputs,
  aiPreferences, // Add AI preferences parameter
  lectureMaterials = [], // Add this parameter
  lectureId = null // Add lectureId for semantic search
) => {
  const [username, setUsername] = useState('User');
  const { generateAIResponse } = useAIResponse();

  // Track total token usage for the session
  const [totalTokenUsage, setTotalTokenUsage] = useState(0);
  const [totalPrompts, setTotalPrompts] = useState(0);

  // Add useEffect to fetch username when component mounts
  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch user data');
        
        const userData = await response.json();
        setUsername(userData.username || 'User');
      } catch (error) {
        console.error('Error fetching username:', error);
        // Fallback to 'User' if fetch fails
        setUsername('User');
      }
    };

    fetchUsername();
  }, []);

  // Calculate initial values when component mounts
  useEffect(() => {
    // Sum up token usage from existing messages
    const tokenSum = messages.reduce((sum, msg) => {
      if (msg.isBot && msg.tokenUsage) {
        return sum + (msg.tokenUsage.total_tokens || 0);
      }
      return sum;
    }, 0);
    
    // Count user messages (prompts)
    const promptCount = messages.filter(msg => !msg.isBot).length;
    
    setTotalTokenUsage(tokenSum);
    setTotalPrompts(promptCount);
  }, [messages]);

  const handleMessageUpdate = useCallback((updatedMessages) => {
    setMessages(updatedMessages);
    // Force scroll to bottom after a small delay to ensure messages are rendered
    setTimeout(() => {
      const simplebarEl = document.querySelector('.simplebar-content-wrapper');
      if (simplebarEl) {
        simplebarEl.scrollTo({
          top: simplebarEl.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  }, [setMessages]);

  // Modify handleNewMessage to use the username
  const handleNewMessage = useCallback(async (text, attachment = null) => {
    if (!userId || !text.trim() || !currentSessionId) return;

    // Check if we've reached the maximum prompts limit
    const maxPromptsLimit = aiPreferences?.numPrompts || 5;
    if (totalPrompts >= maxPromptsLimit) {
      const systemMessage = {
        id: `system-${Date.now()}`,
        isBot: true,
        message: `I apologize, but you've reached the maximum number of prompts (${maxPromptsLimit}) for this session.`,
        timestamp: new Date().toISOString(),
      };
      setMessages([...messages, systemMessage]);
      return;
    }

    // Increment prompt count for the new user message
    setTotalPrompts(prevCount => prevCount + 1);
    
    const messageId = `${Date.now()}-${Math.random()}`;
    
    try {
      setIsGenerating(true);

      // Update user message to use the fetched username
      const userMessage = {
        id: `temp-user-${messageId}`,
        isBot: false,
        avatar: '/user.png',
        name: username, // Use the fetched username here
        message: text.trim(),
        suggestions: [],
        attachments: attachment ? [{
          name: attachment.name,
          content: attachment.content
        }] : [],
        timestamp: new Date().toISOString()
      };

      handleMessageUpdate([...messages, userMessage]);

      const userRes = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          sessionId: currentSessionId,
          message: userMessage
        })
      });

      if (!userRes.ok) throw new Error('Failed to save user message');

      const savedUserMessage = await userRes.json();
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, _id: savedUserMessage._id } : msg
      ));      // Check if the message is asking about a document in lecture materials
      const documentMentioned = findMentionedDocument(text, lectureMaterials);
      
      // Check if we should trigger semantic search for this query
      const shouldUseSemanticSearch = lectureId && 
        shouldTriggerSemanticSearch(text, lectureMaterials) && 
        !attachment && !documentMentioned;
      
      // Format conversation history for the AI
      const conversationHistory = messages.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.attachments && msg.attachments.length > 0 
          ? `${msg.message}\n\nAttached document content:\n${msg.attachments[0].content}`
          : msg.message
      }));
      
      // Determine what to send as the prompt
      let promptToSend = text.trim();
      let attachmentsToSend = attachment ? [attachment] : [];
      let semanticContext = null;
      
      // If there's an uploaded attachment, use that (highest priority)
      if (attachment) {
        promptToSend = `${text.trim()}\n\nHere is the document content to analyze:\n${attachment.content}`;
      } 
      // If user is asking about a specific lecture document (medium priority)
      else if (documentMentioned) {
        promptToSend = `${text.trim()}\n\nHere is the document content to analyze:\n${documentMentioned.content}`;
        
        // Create a virtual attachment from lecture material
        attachmentsToSend = [{
          name: documentMentioned.title,
          content: documentMentioned.content,
          type: documentMentioned.fileType || 'text/plain'
        }];
      }
      // If we should use semantic search for broader context (lower priority)
      else if (shouldUseSemanticSearch) {
        try {
          console.log('Performing semantic search for query:', text);
          const searchResults = await searchLectureMaterials(lectureId, text, {
            limit: 3,
            minSimilarity: 0.6
          });
          
          if (searchResults && searchResults.results && searchResults.results.length > 0) {
            semanticContext = formatSemanticResults(searchResults, 2500);
            
            if (semanticContext) {
              promptToSend = `${text.trim()}\n\n${semanticContext.contextText}`;
              
              console.log(`Enhanced prompt with semantic context from ${semanticContext.totalChunks} chunks`);
              
              // Create virtual attachments for the context
              attachmentsToSend = semanticContext.materialsUsed.map(material => ({
                name: `${material.materialTitle} (AI Retrieved Context)`,
                content: `Context chunks: ${material.chunksUsed}, Avg similarity: ${(material.similarities.reduce((a,b) => a+b, 0) / material.similarities.length).toFixed(3)}`,
                type: 'semantic-context'
              }));
            }
          } else {
            console.log('No relevant semantic results found for query');
          }
        } catch (semanticError) {
          console.error('Semantic search failed:', semanticError);
          // Continue without semantic context - don't break the chat flow
        }
      }      const { response: aiResponse, tokenUsage: messageTokenUsage } = 
        await generateAIResponse(
          promptToSend,
          attachmentsToSend,
          conversationHistory,
          aiPreferences,
          totalPrompts + 1, // message count
          lectureId // Pass lectureId for RAG context
        );

      const botMessage = {
        id: `temp-bot-${messageId}`,
        isBot: true,
        avatar: '/logo.png',
        name: 'BELTO',
        message: aiResponse,
        suggestions: [],
        attachments: [],
        timestamp: new Date().toISOString(),
        tokenUsage: messageTokenUsage
      };

      // Check if we would exceed token limit with this message
      const tokenLimit = aiPreferences?.maxTokens || 2000;
      const newTotalTokens = totalTokenUsage + (messageTokenUsage?.total_tokens || 0);
      
      if (newTotalTokens > tokenLimit) {
        // We've exceeded the token limit
        const limitMessage = {
          id: `limit-${Date.now()}`,
          isBot: true,
          message: `I apologize, but you've reached the maximum token usage limit (${tokenLimit}) for this session.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prevMessages => [...prevMessages, limitMessage]);
      } else {
        // Add bot message and update total token usage
        setTotalTokenUsage(newTotalTokens);
        updateTokenUsage(messageTokenUsage);
        handleMessageUpdate([...messages, userMessage, botMessage]);

        const botRes = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            userId,
            sessionId: currentSessionId,
            message: botMessage
          })
        });

        if (!botRes.ok) throw new Error('Failed to save bot message');

        const savedBotMessage = await botRes.json();
        setMessages(prev => prev.map(msg => 
          msg.id === botMessage.id ? { ...msg, _id: savedBotMessage._id } : msg
        ));
      }

      clearInputs();

    } catch (error) {
      console.error('Error handling message:', error);
      toast.error(error.message || 'Failed to process message');
    } finally {
      setIsGenerating(false);
    }
  }, [
    userId, 
    currentSessionId, 
    messages, 
    generateAIResponse, 
    handleMessageUpdate, 
    setIsGenerating, 
    updateTokenUsage, 
    clearInputs,
    username,
    aiPreferences, // Add to dependencies
    totalTokenUsage,
    totalPrompts,
    lectureMaterials // Add this dependency
  ]);

  const handleDelete = useCallback(async (index) => {
    try {
      const messageToDelete = messages[index];
      if (!messageToDelete?._id || !currentSessionId) {
        throw new Error('Invalid message or session');
      }

      const loadingToast = toast.loading('Deleting message...');

      const response = await fetch(
        `/api/chat/${messageToDelete._id}?sessionId=${currentSessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to delete message');

      if (!messageToDelete.isBot && index + 1 < messages.length) {
        setMessages(prev => prev.filter((_, i) => i !== index && i !== index + 1));
      } else if (messageToDelete.isBot && index > 0) {
        setMessages(prev => prev.filter((_, i) => i !== index && i !== index - 1));
      } else {
        setMessages(prev => prev.filter((_, i) => i !== index));
      }

      // Update token count if it was a bot message with token usage
      if (messageToDelete.isBot && messageToDelete.tokenUsage) {
        setTotalTokenUsage(prev => prev - (messageToDelete.tokenUsage.total_tokens || 0));
      }
      
      // Update prompt count if it was a user message
      if (!messageToDelete.isBot) {
        setTotalPrompts(prev => Math.max(0, prev - 1));
      }

      toast.dismiss(loadingToast);
      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error(error.message || 'Failed to delete message');
    }
  }, [messages, currentSessionId, setMessages]);

  return {
    handleNewMessage,
    handleDelete,
    handleMessageUpdate,
    totalTokenUsage,
    totalPrompts
  };
};

// Helper function to find mentioned documents in the message
const findMentionedDocument = (message, materials) => {
  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    return null;
  }
  
  // Convert message to lowercase for case-insensitive matching
  const lowerMessage = message.toLowerCase();
  
  // Common action words that might indicate document operations
  const actionWords = [
    'summarize', 'analyze', 'read', 'process', 'explain', 'extract', 
    'review', 'check', 'examine', 'interpret', 'look at', 'open', 'show'
  ];
  
  // More specific document-related phrases
  const documentPhrases = [
    'the document', 'this document', 'the file', 'this file', 
    'the pdf', 'the docx', 'the text', 'the content'
  ];
  
  // Check if any document is mentioned by name
  for (const material of materials) {
    if (!material.title) continue;
    
    const documentName = material.title.toLowerCase();
    const fileExtension = documentName.split('.').pop();
    
    // Direct mention of document name or filename without extension
    const nameWithoutExtension = documentName.replace(`.${fileExtension}`, '');
    
    if (lowerMessage.includes(documentName) || 
        lowerMessage.includes(nameWithoutExtension)) {
      return material;
    }
    
    // Check for action words followed by document name
    for (const action of actionWords) {
      if (lowerMessage.includes(`${action} ${documentName}`) || 
          lowerMessage.includes(`${action} the ${fileExtension} file`) ||
          lowerMessage.includes(`${action} ${nameWithoutExtension}`)) {
        return material;
      }
    }
  }
  
  // If there's only one document and user mentions generic document terms
  if (materials.length === 1) {
    for (const phrase of documentPhrases) {
      if (lowerMessage.includes(phrase)) {
        return materials[0];
      }
    }
  }
  
  return null;
};