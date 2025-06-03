import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ChatSession from '@/models/Chat';
import Lecture from '@/models/Lecture';
import { getTokenFromCookie, verifyAuth } from '@/midldleware/authMiddleware';

export async function GET(request) {
  try {
    await connectDB();
    
    // Verify user authentication
    const token = getTokenFromCookie(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyAuth(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get lectureId from query parameters
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    
    if (!lectureId) {
      return NextResponse.json({ error: 'lectureId is required' }, { status: 400 });
    }

    // Verify lecture exists
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }    // Get all chat sessions for this lecture to extract attachments
    const chatSessions = await ChatSession.find({ lectureId })
      .lean(); // Use lean() for better performance

    // Extract all attachments from all messages in all sessions
    const attachments = [];
    
    chatSessions.forEach(session => {
      const sessionMessages = session.messages || [];
      sessionMessages.forEach(msg => {
        if (msg.attachments && msg.attachments.length > 0) {
          attachments.push(...msg.attachments);
        }
      });
    });

    // Include lecture materials uploaded by professor as attachments for RAG context
    if (lecture.materials && lecture.materials.length > 0) {
      lecture.materials.forEach(material => {
        if (material.content) {
          attachments.push({
            name: material.title,
            content: material.content
          });
        }
      });
    };

    // Prepare simplified response
    const response = {
      success: true,
      lectureId: lectureId,
      lectureTitle: lecture.title,
      attachments: attachments
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error retrieving chat context:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve chat context', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
