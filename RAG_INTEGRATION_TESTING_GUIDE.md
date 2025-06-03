# RAG Integration Manual Testing Guide

## 🎯 Overview
This guide will help you test the complete RAG (Retrieval-Augmented Generation) integration that allows AI responses to include context from lecture attachments.

## 🔧 RAG Integration Components

### 1. Chat Context API Endpoint (`/api/chat-context`)
- **Purpose**: Retrieves lecture attachments from chat messages
- **Authentication**: JWT token required
- **Returns**: Lecture title, ID, and all attachments with content

### 2. Enhanced AI Proxy (`/api/ai-proxy`)
- **Purpose**: Generates AI responses with RAG context
- **Enhancement**: Fetches attachment content and includes in system prompt
- **Context Injection**: Adds lecture materials to AI knowledge base

### 3. Frontend Integration
- **Component**: `useAIResponse` and `useChatHandlers` hooks
- **Enhancement**: Passes `lectureId` and `authToken` to AI requests
- **Flow**: Lecture context → AI proxy → Enhanced responses

## 📋 Testing Checklist

### Pre-Testing Setup
- [ ] Ensure you're logged into the system
- [ ] Navigate to a lecture chat session
- [ ] Have some documents ready to upload (PDF, DOC, TXT)

### Step 1: Upload Documents to Lecture
1. **Upload Documents**:
   - Go to a lecture page
   - Upload 1-2 documents with meaningful content
   - Verify documents appear in the lecture materials section

2. **Verify Document Processing**:
   - Check that documents are saved to the database
   - Ensure content is extracted properly

### Step 2: Test Chat Context API
1. **Get Lecture ID**:
   - From the URL or developer tools, note the lecture ID
   - Example: `67cecf4239c46f6c0fe0b0c1`

2. **Test API Endpoint** (Optional - Developer Tools):
   ```bash
   # In browser console or API testing tool:
   fetch('/api/chat-context?lectureId=YOUR_LECTURE_ID', {
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```

3. **Expected Response**:
   ```json
   {
     "success": true,
     "lectureId": "67cecf4239c46f6c0fe0b0c1",
     "lectureTitle": "Your Lecture Title",
     "attachments": [
       {
         "name": "document.pdf",
         "content": "Document content here..."
       }
     ]
   }
   ```

### Step 3: Test RAG-Enhanced AI Responses
1. **Start Chat Session**:
   - Navigate to the chat interface for the lecture
   - Ensure you're in a lecture-specific chat session

2. **Test Queries About Documents**:
   Try these types of questions:
   
   **Direct Document Questions**:
   - "What is this document about?"
   - "Summarize the main points from the uploaded material"
   - "What are the key concepts covered in the lecture materials?"
   
   **Specific Content Questions**:
   - "What does the document say about [specific topic]?"
   - "Can you explain [concept mentioned in document]?"
   - "What examples are given in the materials?"
   
   **General Questions with Context**:
   - "Help me understand this topic" (should use document context)
   - "What should I focus on for studying?" (should reference materials)

### Step 4: Verify RAG Integration
1. **Check AI Response Quality**:
   - [ ] AI responses reference document content
   - [ ] AI mentions which document it's referencing
   - [ ] Responses are more specific and detailed
   - [ ] AI acknowledges having access to course materials

2. **Look for RAG Indicators**:
   The AI should include phrases like:
   - "Based on the course materials..."
   - "According to the document [document name]..."
   - "From the lecture materials, I can see..."
   - "The uploaded document mentions..."

3. **Developer Console Checks**:
   Open browser developer tools and check for:
   - [ ] Console logs: "Fetching RAG context for lecture: [ID]"
   - [ ] Console logs: "RAG context fetched: [Title], [X] attachments"
   - [ ] No errors in console related to RAG fetching

### Step 5: Test Edge Cases
1. **No Documents**:
   - Test in a lecture with no uploaded documents
   - AI should respond normally without document context
   - No errors should occur

2. **Multiple Documents**:
   - Upload multiple documents to one lecture
   - Ask questions that might relate to different documents
   - AI should reference appropriate documents

3. **Large Documents**:
   - Upload a larger document (within limits)
   - Verify the system handles it without timeout errors

## 🔍 Debugging and Troubleshooting

### Console Logs to Monitor
- `Fetching RAG context for lecture: [lectureId]`
- `RAG context fetched: [lectureTitle], [X] attachments`
- `Enhanced prompt with RAG context`

### Common Issues and Solutions

1. **AI Not Using Document Context**:
   - Check if lectureId is being passed correctly
   - Verify user is authenticated (token exists)
   - Check browser console for RAG-related errors

2. **Authentication Errors**:
   - Ensure user is logged in
   - Check JWT token in localStorage
   - Verify token is being sent with requests

3. **No Documents Retrieved**:
   - Verify documents were uploaded successfully
   - Check if documents have content extracted
   - Ensure lectureId matches the current lecture

## 🎉 Success Criteria

### ✅ RAG Integration is Working When:
1. **Document Context Appears**: AI responses include information from uploaded documents
2. **Source Attribution**: AI mentions which documents it's referencing
3. **Enhanced Responses**: Answers are more detailed and lecture-specific
4. **No Errors**: Console shows successful RAG context fetching
5. **Contextual Awareness**: AI demonstrates knowledge of course materials

### 📊 Expected Improvements:
- **Before RAG**: Generic AI responses
- **After RAG**: Lecture-specific responses using document content
- **Quality**: More accurate, detailed, and relevant answers
- **Attribution**: Clear references to source materials

## 🚀 Production Testing URLs

### Main Application:
- **Production**: https://belto.vercel.app
- **Chat Interface**: https://belto.vercel.app/chat
- **Lecture Pages**: https://belto.vercel.app/classes/[classId]/lectures/[lectureId]

### Test Lecture (if available):
- **Lecture ID**: `67cecf4239c46f6c0fe0b0c1`
- **Direct Test URL**: https://belto.vercel.app/api/chat-context?lectureId=67cecf4239c46f6c0fe0b0c1

## 📝 Testing Notes Template

Use this template to document your testing:

```
## RAG Testing Session - [Date]

### Test Environment:
- Browser: [Chrome/Firefox/Safari]
- User Account: [username]
- Lecture ID: [lecture_id]

### Documents Uploaded:
1. [document1.pdf] - [brief description]
2. [document2.doc] - [brief description]

### Test Queries and Results:
1. Query: "[your question]"
   - Response: [AI response]
   - RAG Working: [Yes/No]
   - Document Referenced: [Yes/No]

### Issues Found:
- [Any issues or improvements needed]

### Overall Assessment:
- RAG Integration Status: [Working/Not Working/Partially Working]
- Response Quality: [Excellent/Good/Needs Improvement]
```

## 🎯 Next Steps After Testing

If RAG integration is working:
- [ ] Test with different document types
- [ ] Verify performance with larger documents
- [ ] Test concurrent usage by multiple users
- [ ] Monitor response times and token usage

If issues are found:
- [ ] Document specific error messages
- [ ] Note which steps fail
- [ ] Check browser console for detailed error logs
- [ ] Test with different browsers/devices
