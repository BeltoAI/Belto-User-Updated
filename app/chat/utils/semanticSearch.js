
// Helper function to perform semantic search on lecture materials
export async function searchLectureMaterials(lectureId, query, options = {}, aiPreferences = null) {
  // Use AI preferences RAG settings if available, otherwise fall back to options
  const ragSettings = aiPreferences?.ragSettings || {};
  
  const {
    limit = ragSettings.maxContextChunks || 3,
    minSimilarity = ragSettings.ragSimilarityThreshold || 0.7,
    materialIds = null
  } = options;

  try {
    const response = await fetch(`/api/lectures/${lectureId}/materials/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        query,
        limit,
        minSimilarity,
        materialIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Semantic search failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw error;
  }
}

// Helper function to check if a query should trigger semantic search
export function shouldTriggerSemanticSearch(message, lectureMaterials, aiPreferences = null) {
  // Check if RAG is enabled in preferences
  const ragSettings = aiPreferences?.ragSettings || {};
  if (ragSettings.enableRAG === false) {
    return false;
  }

  if (!message || !lectureMaterials || lectureMaterials.length === 0) {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  // Question words that indicate information seeking
  const questionWords = [
    'what', 'why', 'how', 'when', 'where', 'which', 'who',
    'explain', 'describe', 'tell me', 'can you', 'could you',
    'help me understand', 'what does', 'what is', 'what are'
  ];

  // Academic/content-related keywords
  const academicKeywords = [
    'concept', 'theory', 'principle', 'definition', 'example',
    'formula', 'equation', 'model', 'process', 'method',
    'approach', 'technique', 'strategy', 'solution', 'algorithm',
    'chapter', 'section', 'topic', 'subject', 'material',
    'lecture', 'content', 'information', 'details', 'facts'
  ];

  // Check for question patterns
  const hasQuestionWords = questionWords.some(word => 
    lowerMessage.includes(word)
  );

  // Check for academic content
  const hasAcademicContent = academicKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );

  // Check for specific material mentions
  const mentionsSpecificMaterial = lectureMaterials.some(material => {
    if (!material.title) return false;
    const materialName = material.title.toLowerCase();
    const nameWithoutExtension = materialName.replace(/\.[^/.]+$/, '');
    return lowerMessage.includes(materialName) || lowerMessage.includes(nameWithoutExtension);
  });

  // Adjust trigger sensitivity based on semantic search mode
  const searchMode = ragSettings.semanticSearchMode || 'moderate';
  let shouldTrigger = false;

  switch (searchMode) {
    case 'conservative':
      // Only trigger for explicit questions with academic content
      shouldTrigger = hasQuestionWords && hasAcademicContent;
      break;
    case 'aggressive':
      // Trigger for any academic content or specific mentions
      shouldTrigger = hasAcademicContent || mentionsSpecificMaterial || 
                     (hasQuestionWords && lectureMaterials.length <= 5);
      break;
    case 'moderate':
    default:
      // Balanced approach - original logic
      shouldTrigger = (hasQuestionWords && (hasAcademicContent || lectureMaterials.length <= 3)) || 
                     mentionsSpecificMaterial ||
                     (lowerMessage.includes('?') && hasAcademicContent);
      break;
  }

  return shouldTrigger;
}

// Helper function to format semantic search results for context injection
export function formatSemanticResults(searchResults, maxChars = 3000, aiPreferences = null) {
  if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
    return null;
  }

  const ragSettings = aiPreferences?.ragSettings || {};
  const includeSourceAttribution = ragSettings.includeSourceAttribution !== false; // Default to true
  
  let contextText = '';
  let currentLength = 0;
  
  // Group results by material for better organization
  const groupedResults = {};
  searchResults.results.forEach(result => {
    if (!groupedResults[result.materialId]) {
      groupedResults[result.materialId] = {
        materialTitle: result.materialTitle,
        chunks: []
      };
    }
    groupedResults[result.materialId].chunks.push(result);
  });

  // Format the context with or without source attribution
  if (includeSourceAttribution) {
    contextText += '=== RELEVANT LECTURE MATERIAL CONTEXT ===\n\n';
  }
  
  for (const [materialId, material] of Object.entries(groupedResults)) {
    if (currentLength >= maxChars) break;
    
    if (includeSourceAttribution) {
      contextText += `Material: ${material.materialTitle}\n`;
      contextText += `${'='.repeat(material.materialTitle.length + 10)}\n\n`;
    }
    
    for (const chunk of material.chunks) {
      if (currentLength >= maxChars) break;
      
      const chunkText = `${chunk.content}\n\n`;
      if (currentLength + chunkText.length <= maxChars) {
        contextText += chunkText;
        currentLength += chunkText.length;
      } else {
        // Add partial content if possible
        const remainingChars = maxChars - currentLength;
        if (remainingChars > 100) {
          contextText += chunk.content.substring(0, remainingChars - 10) + '...\n\n';
        }
        break;
      }
    }
    
    if (includeSourceAttribution) {
      contextText += '\n';
    }
  }
  
  if (includeSourceAttribution) {
    contextText += '=== END LECTURE MATERIAL CONTEXT ===\n\n';
  }
  
  return {
    contextText,
    materialsUsed: Object.values(groupedResults).map(m => ({
      materialTitle: m.materialTitle,
      chunksUsed: m.chunks.length,
      similarities: m.chunks.map(c => c.similarity)
    })),
    totalChunks: searchResults.results.length,
    totalLength: currentLength
  };
}

// Helper function to determine if lecture materials are processed
export async function checkMaterialProcessingStatus(lectureId) {
  try {
    const response = await fetch(`/api/lectures/${lectureId}/materials/search`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      return { processed: false, error: 'Failed to check status' };
    }

    const data = await response.json();
    return {
      processed: data.processedMaterials > 0,
      totalMaterials: data.totalMaterials,
      processedMaterials: data.processedMaterials,
      totalChunks: data.totalChunks,
      materials: data.materials
    };
  } catch (error) {
    console.error('Error checking material processing status:', error);
    return { processed: false, error: error.message };
  }
}
