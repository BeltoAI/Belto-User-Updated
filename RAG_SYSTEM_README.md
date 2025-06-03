# RAG (Retrieval-Augmented Generation) System Documentation

## Overview

The RAG system enables students to interact with lecture materials through AI-powered chat with semantic search capabilities. This implementation provides comprehensive document processing, embedding generation, and context-aware AI responses.

## Architecture

### 1. Database Schema
- **LectureMaterialChunk Model**: Stores processed lecture material chunks with embeddings
  - `lectureId`: Reference to the lecture
  - `materialId`: Reference to the original material
  - `content`: Text content of the chunk
  - `embeddings`: Vector embeddings for semantic search
  - `metadata`: Additional information (chunk index, type, etc.)
  - `processed`: Processing status tracking

### 2. API Endpoints

#### Material Processing
- **POST** `/api/lectures/[lectureId]/materials/process`
  - Processes a specific material
  - Extracts text, creates chunks, generates embeddings
  - Updates processing status

- **PUT** `/api/lectures/[lectureId]/materials/process`
  - Batch processes all materials in a lecture
  - Handles existing processed materials

#### Semantic Search
- **GET** `/api/lectures/[lectureId]/materials/search`
  - Performs semantic search using cosine similarity
  - Returns relevant chunks with confidence scores
  - Includes processing status information

### 3. Core Components

#### Semantic Search Utilities (`app/chat/utils/semanticSearch.js`)
- `searchLectureMaterials()`: Performs vector similarity search
- `shouldTriggerSemanticSearch()`: Determines when to use semantic search
- `formatSemanticResults()`: Formats results for context injection
- `checkMaterialProcessingStatus()`: Monitors processing status

#### Chat Integration (`app/chat/hooks/useChatHandlers.js`)
- Enhanced with semantic search capabilities
- Three-tier context priority system:
  1. **High Priority**: Uploaded attachments
  2. **Medium Priority**: Specific document mentions
  3. **Low Priority**: Semantic search results

#### Material Processing Hook (`app/chat/hooks/useMaterialProcessing.js`)
- Manages material processing operations
- Tracks processing status and progress
- Handles batch and individual processing

#### UI Components (`app/chat/components/LectureMaterials.jsx`)
- Visual processing status indicators
- Progress tracking with percentage completion
- Processing control buttons
- Enhanced user guidance

## Usage Guide

### For Professors

1. **Upload Materials**: Use the existing material upload functionality
2. **Process Materials**: Click "Process All Materials" button in the chat interface
3. **Monitor Progress**: Watch the progress indicators and status dots
4. **Verify Processing**: Green dots indicate successful processing

### For Students

1. **Ask Questions**: Type questions about lecture materials in the chat
2. **Automatic Search**: The system automatically triggers semantic search for relevant queries
3. **Context-Aware Responses**: AI responses include relevant material excerpts
4. **Document References**: Responses indicate which materials were used for context

## Technical Features

### Semantic Search Triggers
The system automatically triggers semantic search when queries contain:
- Question words (what, how, why, when, where)
- Academic terms (explain, define, describe, analyze)
- Material-related keywords (lecture, slide, reading, chapter)

### Context Injection
- **Priority System**: Ensures most relevant context is used
- **Token Management**: Respects AI model token limits
- **Source Attribution**: Tracks which materials contribute to responses

### Processing Pipeline
1. **Text Extraction**: Extracts content from various file formats
2. **Chunking**: Splits large documents into manageable pieces
3. **Embedding Generation**: Creates vector representations using AI
4. **Storage**: Saves chunks and embeddings to database
5. **Indexing**: Creates efficient search indexes

## Configuration

### Environment Variables
```env
# AI Service Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Database Configuration
DATABASE_URL=your_database_url
```

### Processing Settings
- **Chunk Size**: 1000 characters (configurable)
- **Chunk Overlap**: 200 characters
- **Embedding Model**: text-embedding-ada-002
- **Search Similarity Threshold**: 0.7

## API Reference

### Process Materials
```javascript
// Process specific material
POST /api/lectures/123/materials/process
{
  "materialId": "material_456"
}

// Process all materials
PUT /api/lectures/123/materials/process
```

### Search Materials
```javascript
// Semantic search
GET /api/lectures/123/materials/search?query=machine+learning&limit=5

Response:
{
  "results": [
    {
      "content": "Machine learning is...",
      "similarity": 0.85,
      "metadata": { "materialId": "456", "chunkIndex": 2 }
    }
  ],
  "status": {
    "total": 10,
    "processed": 8,
    "processing": 2
  }
}
```

## Integration Examples

### Chat Handler Usage
```javascript
const { handleNewMessage } = useChatHandlers(
  userId,
  sessionId,
  messages,
  setMessages,
  setIsGenerating,
  updateTokenUsage,
  clearInputs,
  aiPreferences,
  lectureMaterials,
  lectureId  // Required for semantic search
);
```

### Material Processing
```javascript
const { processAllMaterials, getProcessingStatus } = useMaterialProcessing();

// Process all materials
await processAllMaterials(lectureId);

// Check status
const status = await getProcessingStatus(lectureId);
```

## Performance Considerations

### Optimization Features
- **Lazy Loading**: Materials processed on-demand
- **Batch Processing**: Efficient bulk operations
- **Caching**: Repeated queries use cached results
- **Indexing**: Optimized database queries

### Scalability
- **Chunked Processing**: Handles large documents
- **Background Processing**: Non-blocking operations
- **Progress Tracking**: Real-time status updates
- **Error Recovery**: Robust error handling

## Troubleshooting

### Common Issues

1. **Materials Not Processing**
   - Check API endpoints are accessible
   - Verify database connections
   - Review error logs

2. **Semantic Search Not Working**
   - Ensure materials are processed (green status dots)
   - Check embeddings are generated
   - Verify query triggers semantic search

3. **Poor Search Results**
   - Adjust similarity threshold
   - Review chunk size settings
   - Check embedding model configuration

### Debugging Tools

- **Processing Status**: Visual indicators in UI
- **Browser Console**: Detailed error messages
- **API Logs**: Server-side debugging
- **Database Queries**: Direct inspection of chunks

## Future Enhancements

### Planned Features
- **Advanced Filtering**: Filter by material type, date, topic
- **Personalized Search**: User-specific relevance scoring
- **Multi-modal Support**: Images, videos, audio processing
- **Analytics Dashboard**: Usage statistics and insights

### Performance Improvements
- **Vector Database**: Dedicated vector storage solution
- **Streaming Processing**: Real-time chunk processing
- **Distributed Search**: Multi-node search capabilities
- **Smart Caching**: Intelligent cache management

## Support

For technical support or feature requests:
1. Check the troubleshooting section
2. Review API documentation
3. Contact development team
4. Submit GitHub issues (if applicable)

---

**Last Updated**: May 31, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅
