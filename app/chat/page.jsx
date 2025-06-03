"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SimpleBar from 'simplebar-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'simplebar-react/dist/simplebar.min.css';
import PropTypes from 'prop-types';
import ChatMessage from '../components/Chat/ChatMessage';
import ChatInput from '../components/Chat/ChatInput';
import useChatStore from '@/store/chatStore';
import { LoadingMessage } from './components/LoadingMessage';
import { customScrollbarStyles } from './styles/scrollbar';
import { processFiles } from './utils/fileProcessing';
import { useChatHandlers } from './hooks/useChatHandlers';
import { useMessageReactions } from './hooks/useMessageReactions';
import { useAIPreferences } from './hooks/useAIPreferences';
import { useLectureContext } from './hooks/useLectureContext';
import { LectureMaterials } from './components/LectureMaterials';

// Create a wrapper component that uses searchParams
function ChatPageContent({ inputText, selectedFiles, isWideView, selectedModel }) {
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const processingRef = useRef(false);
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [lectureId, setLectureId] = useState(null);

  const {
    currentSessionId,
    setCurrentSessionId,
    messages,
    isLoading,
    isGenerating,
    currentInput,
    currentAttachment,
    userId,
    setUserId,
    clearInputs,
    fetchChatHistory,
    setMessages,
    updateTokenUsage,
    setCurrentAttachment,
    setIsGenerating
  } = useChatStore();

  // Use our AI preferences hook
  const { aiPreferences, isLoading: aiPreferencesLoading } = useAIPreferences(lectureId);

  // Use our message reactions hook with studentId
  const {
    reactions,
    toggleLike: handleToggleLike,
    toggleDislike: handleToggleDislike,
  } = useMessageReactions(userId, currentSessionId, studentId);
  // Use our lecture context hook to get materials
  const { lectureMaterials, isLoadingMaterials } = useLectureContext(lectureId, currentSessionId);  // Use our chat handlers with token and prompt tracking
  const { 
    handleNewMessage, 
    handleDelete, 
    totalTokenUsage, 
    totalPrompts 
  } = useChatHandlers(
    userId,
    currentSessionId,
    messages,
    setMessages,
    setIsGenerating,
    updateTokenUsage,
    clearInputs,
    aiPreferences,
    lectureMaterials,
    lectureId // Add lectureId parameter for semantic search
  );

  const simpleBarRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (simpleBarRef.current) {
      const scrollElement = simpleBarRef.current.getScrollElement();
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // Scroll on session change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [currentSessionId, scrollToBottom]);

  // Scroll on new messages or AI response
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Scroll when generating starts/ends
  useEffect(() => {
    if (isGenerating || messages.length > 0) {
      scrollToBottom();
    }
  }, [isGenerating, messages.length, scrollToBottom]);

  // Fetch session details to get lectureId
  useEffect(() => {
    const fetchSessionDetails = async () => {
      if (!currentSessionId) return;
      
      try {
        const response = await fetch(`/api/chats/sessions/${currentSessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session details');
        
        const sessionData = await response.json();
        if (sessionData.lectureId) {
          setLectureId(sessionData.lectureId);
        }
      } catch (error) {
        console.error('Error fetching session details:', error);
      }
    };
    
    fetchSessionDetails();
  }, [currentSessionId]);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!userId || !currentSessionId) return;
      
      try {
        setIsSessionLoading(true);
        setHistoryLoaded(false);
        const history = await fetchChatHistory();
        const updatedHistory = history.map(msg => {
          if (msg.isBot && !msg.tokenUsage) {
            return {
              ...msg,
              tokenUsage: {
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0
              }
            };
          }
          return msg;
        });
        
        setMessages(updatedHistory);
        setHistoryLoaded(true);
        
        // Scroll to bottom after loading history with a delay
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      } catch (error) {
        console.error('Error loading chat history:', error);
        toast.error('Failed to load chat history');
      } finally {
        setIsSessionLoading(false);
      }
    };

    loadChatHistory();
  }, [userId, currentSessionId, fetchChatHistory, scrollToBottom, setMessages]);

  // Get studentId from URL params
  useEffect(() => {
    const studentIdParam = searchParams.get('studentId');
    if (studentIdParam) {
      setStudentId(studentIdParam);
    }
  }, [searchParams]);

  const handleCopy = (index) => {
    navigator.clipboard.writeText(messages[index].message);
    toast.success('Message copied to clipboard!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Handle flagged content submission
    if (e.isFlaggedContent) {
      const text = e.messageText;
      if (!text || processingRef.current) return;
      
      try {
        processingRef.current = true;
        await handleNewMessage(text, currentAttachment);
        scrollToBottom();
      } catch (error) {
        console.error('Error submitting flagged message:', error);
      } finally {
        processingRef.current = false;
      }
      return;
    }
    
    // Regular submission
    const text = currentInput.trim();
    if (!text || processingRef.current) return; 
    
    try {
      processingRef.current = true;
      await handleNewMessage(text, currentAttachment);
      scrollToBottom(); 
    } catch (error) {
      console.error('Error submitting message:', error);
    } finally {
      processingRef.current = false;
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if uploads are allowed according to AI preferences
    if (aiPreferences && aiPreferences.processingRules && 
        aiPreferences.processingRules.allowUploads === false) {
      toast.error('File uploads are not allowed in this lecture');
      return;
    }
    
    processFiles([file], (processedFiles) => {
      if (processedFiles && processedFiles.length > 0) {
        setCurrentAttachment(processedFiles[0]);
      }
    }, toast);
  };

  // Display AI preferences badge if available
  const renderAIBadge = () => {
    if (!aiPreferences) return null;
    
    // Calculate usage percentages for visual indicators
    const tokenLimit = aiPreferences.maxTokens || 2000;
    const promptLimit = aiPreferences.numPrompts || 5;
    const tokenUsagePercent = Math.min(100, Math.round((totalTokenUsage / tokenLimit) * 100));
    const promptUsagePercent = Math.min(100, Math.round((totalPrompts / promptLimit) * 100));
    
    return (
      <div className="mb-2 mx-4 py-2 px-3 bg-[#262626] rounded-md flex flex-wrap items-center gap-2">
        {aiPreferences.model && (
          <span className="text-xs bg-[#363636] px-2 py-1 rounded">
            <span className="text-[#FFB800]">AI:</span> {aiPreferences.model}
          </span>
        )}
        
        <span className="text-xs bg-[#363636] px-2 py-1 rounded">
          <span className="text-[#FFB800]">Temp:</span> {aiPreferences.temperature}
        </span>
        
        <span className="text-xs bg-[#363636] px-2 py-1 rounded">
          <span className="text-[#FFB800]">Tokens:</span> {totalTokenUsage}/{tokenLimit}
          <div className="w-full h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
            <div 
              className={`h-full ${tokenUsagePercent > 75 ? 'bg-red-500' : 'bg-green-500'}`} 
              style={{ width: `${tokenUsagePercent}%` }}
            ></div>
          </div>
        </span>
        
        <span className="text-xs bg-[#363636] px-2 py-1 rounded">
          <span className="text-[#FFB800]">Prompts:</span> {totalPrompts}/{promptLimit}
          <div className="w-full h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
            <div 
              className={`h-full ${promptUsagePercent > 75 ? 'bg-red-500' : 'bg-green-500'}`} 
              style={{ width: `${promptUsagePercent}%` }}
            ></div>
          </div>
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <style>{customScrollbarStyles}</style>
      {aiPreferences && renderAIBadge()}
      <SimpleBar 
        ref={simpleBarRef}
        className="flex-1 overflow-y-auto" 
        style={{ maxHeight: 'calc(100vh - 100px)' }}
        autoHide={false}
        timeout={100}
      >
        <div ref={chatContainerRef}>
          {isLoading || isSessionLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="flex flex-col items-center">
                <div className="text-[#FFB800] mb-2">Loading chat history...</div>
                <div className="text-xs text-gray-400">
                  Session ID: {currentSessionId?.slice(-6) || 'Not set'}
                </div>
              </div>
            </div>
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-400">No messages yet. Start a conversation!</div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage
                  key={`${message.id || index}-${index}`}
                  {...message}
                  onLike={() => handleToggleLike(message.id)}
                  onDislike={() => handleToggleDislike(message.id)}
                  onCopy={() => handleCopy(index)}
                  onDelete={() => handleDelete(index)}
                  liked={reactions[message.id] === 'like'}
                  disliked={reactions[message.id] === 'dislike'}
                  tokenUsage={message.isBot ? (message.tokenUsage || null) : null}
                />
              ))}
              {isGenerating && <LoadingMessage />}
            </>
          )}
        </div>
      </SimpleBar>
      
      <LectureMaterials 
        materials={lectureMaterials} 
        isLoading={isLoadingMaterials} 
        lectureId={lectureId}
      />
      
      <ChatInput
        handleSubmit={handleSubmit}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        isGenerating={isGenerating}
        disableFileUpload={aiPreferences?.processingRules?.allowUploads === false}
        sessionId={currentSessionId}
        userId={userId}
      />
    </div>
  );
}

// Create a loading fallback component
function ChatPageLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-8 w-24 bg-gray-700 rounded mb-3"></div>
        <div className="text-gray-400">Loading chat...</div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
const ChatPage = (props) => {
  return (
    <Suspense fallback={<ChatPageLoading />}>
      <ChatPageContent {...props} />
    </Suspense>
  );
};

ChatPage.propTypes = {
  inputText: PropTypes.string,
  selectedFiles: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      content: PropTypes.string,
    })
  ),
  isWideView: PropTypes.bool,
  selectedModel: PropTypes.string,
};

ChatPage.defaultProps = {
  inputText: '',
  selectedFiles: [],
  isWideView: false,
  selectedModel: 'Llama 3',
};

export default ChatPage;