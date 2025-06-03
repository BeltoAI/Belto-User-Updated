import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import LectureMaterialChunk from '@/models/LectureMaterialChunk';
import Lecture from '@/models/Lecture';

// Helper function to extract text from URL-based files
async function extractTextFromUrl(fileUrl, fileType) {
  try {
    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(20000) // 20 second timeout for file fetch
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Use the same extraction APIs as the client-side processing
    let extractedText = '';
    const baseUrl = process.env.NEXTAUTH_URL || 'https://belto.vercel.app';

    if (fileType === 'application/pdf' || fileUrl.toLowerCase().endsWith('.pdf')) {
      const extractResponse = await fetch(`${baseUrl}/api/belto-proxy/process_pdf_base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': process.env.BELTO_API_KEY || '123456789012345'
        },
        body: JSON.stringify({ file_base64: base64 }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for PDF processing
      });

      if (extractResponse.ok) {
        const result = await extractResponse.json();
        extractedText = result.text || '';
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               fileUrl.toLowerCase().endsWith('.docx')) {
      const extractResponse = await fetch(`${baseUrl}/api/belto-proxy/process_docx_base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': process.env.BELTO_API_KEY || '123456789012345'
        },
        body: JSON.stringify({ file_base64: base64 }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for DOCX processing
      });

      if (extractResponse.ok) {
        const result = await extractResponse.json();
        extractedText = result.text || '';
      }
    } else if (fileType === 'text/plain' || fileUrl.toLowerCase().endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    return extractedText.trim();
  } catch (error) {
    console.error('Error extracting text from URL:', error);
    throw error;
  }
}

// Helper function to chunk text
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let currentIndex = 0;
  const textLength = text.length;

  while (currentIndex < textLength) {
    let end = Math.min(currentIndex + chunkSize, textLength);

    // Try to find a natural break point
    if (end < textLength) {
      let adjustedEnd = -1;
      for (let j = Math.min(end + 50, textLength - 1); j >= Math.max(0, end - 50, currentIndex + 1); j--) {
        if ('.!?'.includes(text[j])) {
          if ((j + 1 < textLength && text[j + 1] === ' ') || j + 1 === textLength) {
            adjustedEnd = j + 1;
            break;
          }
        }
      }
      if (adjustedEnd !== -1 && adjustedEnd > currentIndex) {
        end = adjustedEnd;
      }
    }

    const chunkContent = text.substring(currentIndex, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        metadata: { startChar: currentIndex, endChar: end }
      });
    }
    
    if (end === textLength) break;

    currentIndex = end - overlap;
    if (currentIndex < 0) currentIndex = 0;
  }

  return chunks;
}

// Helper function to generate embeddings
async function generateEmbeddings(texts) {
  try {
    // Use the Vercel proxy endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'https://belto.vercel.app';
    const response = await fetch(`${baseUrl}/api/belto-proxy/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.BELTO_EMBEDDINGS_API_KEY || '123456789012345'
      },
      body: JSON.stringify({ text: texts }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Embeddings API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.embeddings || [];
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

export async function POST(request, { params }) {
  try {
    await connectDB();

    const { lectureId } = params;
    const { materialId, force = false } = await request.json();

    // Validate lecture exists
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    // Find the specific material
    const material = lecture.materials.find(m => m._id.toString() === materialId);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Check if already processed (unless force is true)
    if (!force) {
      const existingChunks = await LectureMaterialChunk.findOne({ 
        lectureId, 
        materialId 
      });
      if (existingChunks) {
        return NextResponse.json({ 
          message: 'Material already processed',
          materialId,
          chunksCount: await LectureMaterialChunk.countDocuments({ lectureId, materialId })
        });
      }
    } else {
      // Remove existing chunks if force processing
      await LectureMaterialChunk.deleteMany({ lectureId, materialId });
    }

    // Extract text from the material
    console.log(`Processing material: ${material.title} (${material.fileType})`);
    const extractedText = await extractTextFromUrl(material.fileUrl, material.fileType);

    if (!extractedText) {
      return NextResponse.json({ 
        error: 'No text content could be extracted from the material' 
      }, { status: 400 });
    }

    // Chunk the text
    const chunks = chunkText(extractedText, 1000, 200);
    if (chunks.length === 0) {
      return NextResponse.json({ 
        error: 'No chunks were generated from the material' 
      }, { status: 400 });
    }

    // Generate embeddings
    const chunkTexts = chunks.map(chunk => chunk.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    if (embeddings.length !== chunks.length) {
      return NextResponse.json({ 
        error: 'Mismatch in embeddings count' 
      }, { status: 500 });
    }

    // Save chunks to database
    const materialChunks = chunks.map((chunk, index) => ({
      lectureId,
      materialId,
      materialTitle: material.title,
      originalFilename: material.title,
      fileType: material.fileType,
      chunkIndex: index,
      content: chunk.content,
      embedding: embeddings[index],
      metadata: {
        ...chunk.metadata,
        totalChunks: chunks.length,
        uploadedAt: material.uploadedAt
      }
    }));

    await LectureMaterialChunk.insertMany(materialChunks);

    console.log(`Successfully processed material: ${material.title}, created ${chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      materialId,
      materialTitle: material.title,
      chunksCreated: chunks.length,
      textLength: extractedText.length
    });

  } catch (error) {
    console.error('Error processing lecture material:', error);
    return NextResponse.json({ 
      error: 'Failed to process material',
      details: error.message 
    }, { status: 500 });
  }
}

// Endpoint to process all materials in a lecture
export async function PUT(request, { params }) {
  try {
    await connectDB();

    const { lectureId } = params;
    const { force = false } = await request.json();

    // Validate lecture exists
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    if (!lecture.materials || lecture.materials.length === 0) {
      return NextResponse.json({ 
        message: 'No materials found in lecture',
        processed: []
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;    // Process each material
    for (const material of lecture.materials) {
      try {
        console.log(`Processing material: ${material.title} (ID: ${material._id})`);
        
        // Check if already processed
        if (!force) {
          const existingChunks = await LectureMaterialChunk.findOne({ 
            lectureId, 
            materialId: material._id.toString() 
          });
          if (existingChunks) {
            results.push({
              materialId: material._id.toString(),
              materialTitle: material.title,
              status: 'skipped',
              message: 'Already processed'
            });
            continue;
          }
        }

        // Validate material has required properties
        if (!material.fileUrl) {
          throw new Error('Material missing file URL');
        }

        if (!material.fileType) {
          throw new Error('Material missing file type');
        }

        // Process the material (same logic as POST)
        const extractedText = await extractTextFromUrl(material.fileUrl, material.fileType);
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text content extracted from material');
        }

        const chunks = chunkText(extractedText, 1000, 200);
        if (chunks.length === 0) {
          throw new Error('No chunks generated from extracted text');
        }

        const chunkTexts = chunks.map(chunk => chunk.content);
        const embeddings = await generateEmbeddings(chunkTexts);

        if (embeddings.length !== chunks.length) {
          throw new Error(`Embeddings count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
        }

        // Remove existing chunks if force
        if (force) {
          await LectureMaterialChunk.deleteMany({ 
            lectureId, 
            materialId: material._id.toString() 
          });
        }

        const materialChunks = chunks.map((chunk, index) => ({
          lectureId,
          materialId: material._id.toString(),
          materialTitle: material.title,
          originalFilename: material.title,
          fileType: material.fileType,
          chunkIndex: index,
          content: chunk.content,
          embedding: embeddings[index],
          metadata: {
            ...chunk.metadata,
            totalChunks: chunks.length,
            uploadedAt: material.uploadedAt
          }
        }));

        await LectureMaterialChunk.insertMany(materialChunks);

        results.push({
          materialId: material._id.toString(),
          materialTitle: material.title,
          status: 'success',
          chunksCreated: chunks.length,
          textLength: extractedText.length
        });

        successCount++;

      } catch (error) {
        console.error(`Error processing material ${material.title}:`, error);
        results.push({
          materialId: material._id.toString(),
          materialTitle: material.title,
          status: 'error',
          error: error.message || 'Unknown processing error'
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: lecture.materials.length,
        processed: successCount,
        errors: errorCount,
        skipped: lecture.materials.length - successCount - errorCount
      },
      results
    });

  } catch (error) {
    console.error('Error processing lecture materials:', error);
    return NextResponse.json({ 
      error: 'Failed to process materials',
      details: error.message 
    }, { status: 500 });
  }
}
