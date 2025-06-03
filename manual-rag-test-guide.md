# 🧪 Manual RAG System Testing Guide

## Quick Test Checklist

### Step 1: Access the Application
1. Go to https://belto.vercel.app
2. Login with your credentials
3. Navigate to a chat session that has lecture materials

### Step 2: Verify Lecture Materials Processing
1. Look for the **"Lecture Materials"** section in the chat interface
2. Check the processing status indicators:
   - 🟡 **Yellow dots** = Materials not yet processed for AI search
   - 🟢 **Green dots** = Materials processed and ready for AI search
3. If you see yellow dots, click **"Process All Materials"**
4. Watch the progress bar and wait for completion

### Step 3: Test Semantic Search Functionality

#### Test Questions (Should Trigger RAG):
Ask these questions in the chat to test if AI uses lecture materials as context:

✅ **Academic Questions**:
- "What are the key concepts in the lecture materials?"
- "Explain the main theory from the PDF"
- "Summarize the important points from the reading"
- "How does this relate to the lecture content?"
- "Can you help me understand the material?"

✅ **Specific Material Questions**:
- "Tell me about [specific document name]"
- "What does the lecture say about [topic]?"
- "Explain the methodology from the research paper"

#### Control Questions (Should NOT Trigger RAG):
❌ **General Questions** (shouldn't use materials):
- "Hello, how are you?"
- "What's the weather like?"
- "Help me with my homework" (without context)

### Step 4: Verify RAG is Working

#### Look for these indicators that RAG is active:

1. **Processing Status**: Green dots next to all materials
2. **AI Response Quality**: 
   - Responses should reference specific lecture content
   - AI should mention source materials
   - Answers should be more detailed and accurate for content-related questions
3. **Console Logs** (Open Developer Tools → Console):
   - Should see "Performing semantic search for query: [your question]"
   - Should see "Enhanced prompt with semantic context from X chunks"

### Step 5: Verify Different Priority Levels

#### Test the 3-tier priority system:

1. **High Priority - File Upload**: 
   - Upload a document and ask about it → AI should analyze that specific document

2. **Medium Priority - Document Mention**:
   - Ask "Tell me about [specific lecture PDF name]" → AI should focus on that specific material

3. **Low Priority - Semantic Search**:
   - Ask general questions → AI should search all materials for relevant content

## Expected Results

### ✅ Working RAG System Should Show:
- Materials process successfully (green status indicators)
- Academic questions trigger semantic search
- AI responses include relevant lecture content
- Responses mention which materials were referenced
- Better quality answers for content-related questions

### ❌ Issues to Report:
- Materials stuck on yellow status (processing failed)
- AI gives generic answers to material-specific questions
- No console logs about semantic search
- Processing errors or timeouts

## Troubleshooting

### If Materials Won't Process:
1. Check browser console for errors
2. Try processing individual materials first
3. Refresh the page and try again

### If RAG Isn't Working:
1. Ensure materials show green status
2. Try more specific academic questions
3. Check that you're in a lecture-based chat session

### If Poor Search Results:
1. Try rephrasing your question to be more specific
2. Mention specific concepts from the materials
3. Use question words like "what", "how", "explain"

---

## 🎯 Success Metrics

**RAG System is Working If**:
- [x] Materials can be processed successfully
- [x] Academic questions get enhanced responses
- [x] AI references specific lecture content
- [x] Response quality improves for material-related queries
- [x] Console shows semantic search activity

---

**Last Updated**: June 1, 2025  
**System Status**: ✅ Production Ready
