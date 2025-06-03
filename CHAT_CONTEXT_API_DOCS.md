# Chat Context API Endpoint

## Overview
The `/api/chat-context` endpoint provides comprehensive chat context data for a specific lecture, including all chat sessions, message statistics, and user engagement metrics.

## Endpoint Details

### URL
```
GET /api/chat-context?lectureId={lectureId}
```

### Authentication
- **Required**: JWT token via HTTP-only cookie
- **Middleware**: Uses `authMiddleware` for token verification
- **Returns 401** if unauthorized

### Parameters
- `lectureId` (required): MongoDB ObjectId of the lecture

### Response Format
```json
{
  "success": true,
  "lectureId": "507f1f77bcf86cd799439011",
  "lectureTitle": "Introduction to Machine Learning",
  "summary": {
    "totalSessions": 15,
    "totalMessages": 234,
    "totalUserMessages": 117,
    "totalBotMessages": 117,
    "totalAttachments": 8,
    "uniqueUsers": 12,
    "averageMessagesPerSession": 16
  },
  "chatSessions": [
    {
      "sessionId": "507f1f77bcf86cd799439012",
      "userId": "user123",
      "title": "Chat Session Title",
      "createdAt": "2023-12-01T10:30:00.000Z",
      "updatedAt": "2023-12-01T11:45:00.000Z",
      "messageCount": 16,
      "userMessageCount": 8,
      "botMessageCount": 8,
      "messages": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "isBot": false,
          "avatar": "/user.png",
          "name": "John Doe",
          "message": "What is machine learning?",
          "suggestions": [],
          "attachments": [],
          "timestamp": "2023-12-01T10:30:00.000Z",
          "tokenUsage": {
            "total_tokens": 25,
            "prompt_tokens": 15,
            "completion_tokens": 10
          }
        }
      ]
    }
  ],
  "metadata": {
    "retrievedAt": "2023-12-01T12:00:00.000Z",
    "userId": "admin123"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "lectureId is required"
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

#### 404 Not Found
```json
{
  "error": "Lecture not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to retrieve chat context",
  "details": "Error details here"
}
```

## Features

### Data Analytics
- **Session Statistics**: Total sessions, messages per session
- **Message Analytics**: User vs bot message counts
- **User Engagement**: Unique user count, attachment usage
- **Performance Metrics**: Average messages per session

### Security
- **Authentication**: JWT token verification
- **Authorization**: User-based access control
- **Data Validation**: Input parameter validation
- **Error Handling**: Comprehensive error responses

### Performance Optimizations
- **Lean Queries**: Uses `.lean()` for better MongoDB performance
- **Indexed Fields**: Optimized database queries on `lectureId`
- **Efficient Processing**: Streaming data processing for large datasets

## Usage Examples

### JavaScript/Frontend
```javascript
const fetchChatContext = async (lectureId) => {
  try {
    const response = await fetch(`/api/chat-context?lectureId=${lectureId}`, {
      method: 'GET',
      credentials: 'include' // Include cookies for authentication
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch chat context:', error);
    throw error;
  }
};
```

### cURL
```bash
curl -X GET \
  'http://localhost:3000/api/chat-context?lectureId=507f1f77bcf86cd799439011' \
  -H 'Cookie: token=your-jwt-token-here'
```

## Implementation Notes

1. **Database Models**: Uses `ChatSession` and `Lecture` models
2. **Authentication**: Integrates with existing JWT auth middleware
3. **Error Handling**: Comprehensive error catching and logging
4. **Performance**: Optimized for large datasets with `.lean()` queries
5. **Compatibility**: Compatible with existing chat and lecture systems

## Related Endpoints
- `GET /api/chats/sessions` - Get user chat sessions
- `GET /api/lectures/{lectureId}` - Get lecture details
- `GET /api/chat/history` - Get chat history for a session
