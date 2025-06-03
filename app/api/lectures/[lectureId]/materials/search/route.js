import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import LectureMaterialChunk from '@/models/LectureMaterialChunk';
import Lecture from '@/models/Lecture';

// Helper function to generate query embedding
async function generateQueryEmbedding(query) {
  try {
    const response = await fetch(`${process.env.BELTO_EMBEDDINGS_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.BELTO_EMBEDDINGS_API_KEY || '123456789012345'
      },
      body: JSON.stringify({ text: [query] })
    });

    if (!response.ok) {
      throw new Error(`Embeddings API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.embeddings?.[0] || null;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    throw error;
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export async function POST(request, { params }) {
  try {
    await connectDB();

    const { lectureId } = params;
    const { 
      query, 
      limit = 5, 
      minSimilarity = 0.5,
      materialIds = null // Optional: filter by specific materials
    } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Validate lecture exists
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query.trim());
    if (!queryEmbedding) {
      return NextResponse.json({ 
        error: 'Failed to generate query embedding' 
      }, { status: 500 });
    }

    // Build search filter
    const searchFilter = { lectureId };
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      searchFilter.materialId = { $in: materialIds };
    }

    // Retrieve all chunks for the lecture (or filtered materials)
    const chunks = await LectureMaterialChunk.find(searchFilter)
      .select('materialId materialTitle content embedding metadata chunkIndex')
      .lean();

    if (chunks.length === 0) {
      return NextResponse.json({
        results: [],
        message: 'No processed materials found for this lecture',
        totalChunks: 0
      });
    }

    // Calculate similarities and rank results
    const similarities = chunks.map(chunk => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        ...chunk,
        similarity,
        _id: chunk._id.toString(),
        lectureId: chunk.lectureId.toString()
      };
    });

    // Filter by minimum similarity and sort by similarity score
    const filteredResults = similarities
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Group results by material for better organization
    const groupedResults = {};
    filteredResults.forEach(result => {
      const materialId = result.materialId;
      if (!groupedResults[materialId]) {
        groupedResults[materialId] = {
          materialId,
          materialTitle: result.materialTitle,
          chunks: []
        };
      }
      groupedResults[materialId].chunks.push({
        chunkIndex: result.chunkIndex,
        content: result.content,
        similarity: result.similarity,
        metadata: result.metadata
      });
    });

    return NextResponse.json({
      query,
      results: filteredResults.map(result => ({
        materialId: result.materialId,
        materialTitle: result.materialTitle,
        chunkIndex: result.chunkIndex,
        content: result.content,
        similarity: result.similarity,
        metadata: result.metadata
      })),
      groupedByMaterial: Object.values(groupedResults),
      totalFound: filteredResults.length,
      totalChunks: chunks.length,
      minSimilarity,
      queryEmbeddingGenerated: true
    });

  } catch (error) {
    console.error('Error in semantic search:', error);
    return NextResponse.json({ 
      error: 'Failed to perform semantic search',
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check material processing status
export async function GET(request, { params }) {
  try {
    await connectDB();

    const { lectureId } = params;
    const url = new URL(request.url);
    const materialId = url.searchParams.get('materialId');

    // Validate lecture exists
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    let filter = { lectureId };
    if (materialId) {
      filter.materialId = materialId;
    }

    // Get processing status
    const chunks = await LectureMaterialChunk.find(filter)
      .select('materialId materialTitle chunkIndex processed createdAt')
      .lean();

    if (materialId) {
      // Status for specific material
      const material = lecture.materials.find(m => m._id.toString() === materialId);
      if (!material) {
        return NextResponse.json({ error: 'Material not found' }, { status: 404 });
      }

      return NextResponse.json({
        materialId,
        materialTitle: material.title,
        isProcessed: chunks.length > 0,
        chunksCount: chunks.length,
        lastProcessed: chunks.length > 0 ? 
          Math.max(...chunks.map(c => new Date(c.createdAt).getTime())) : null
      });
    } else {
      // Status for all materials in lecture
      const materialStatus = {};
      
      // Initialize status for all materials
      lecture.materials.forEach(material => {
        const materialChunks = chunks.filter(c => c.materialId === material._id.toString());
        materialStatus[material._id.toString()] = {
          materialId: material._id.toString(),
          materialTitle: material.title,
          isProcessed: materialChunks.length > 0,
          chunksCount: materialChunks.length,
          lastProcessed: materialChunks.length > 0 ? 
            Math.max(...materialChunks.map(c => new Date(c.createdAt).getTime())) : null
        };
      });

      return NextResponse.json({
        lectureId,
        totalMaterials: lecture.materials.length,
        processedMaterials: Object.values(materialStatus).filter(s => s.isProcessed).length,
        totalChunks: chunks.length,
        materials: Object.values(materialStatus)
      });
    }

  } catch (error) {
    console.error('Error checking material status:', error);
    return NextResponse.json({ 
      error: 'Failed to check material status',
      details: error.message 
    }, { status: 500 });
  }
}
