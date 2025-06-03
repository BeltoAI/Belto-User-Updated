

// Helper function to fetch attachment content from chat context
export async function fetchAttachmentContent(lectureId) {
  try {
    const response = await fetch(`/api/chat-context?lectureId=${lectureId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch attachment content');
    }

    const data = await response.json();
    return {
      success: true,
      lectureTitle: data.lectureTitle,
      attachments: data.attachments || [],
      totalAttachments: data.attachments?.length || 0
    };
  } catch (error) {
    console.error('Error fetching attachment content:', error);
    return {
      success: false,
      error: error.message,
      attachments: [],
      totalAttachments: 0
    };
  }
}

// Helper function to search through attachment content for relevant matches
export function searchAttachmentContent(attachments, query, options = {}) {
  const { minRelevanceScore = 0.3, maxResults = 3 } = options;
  
  if (!attachments || attachments.length === 0) {
    return { results: [], totalSearched: 0 };
  }

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
  
  const results = [];
  
  attachments.forEach((attachment, index) => {
    if (!attachment.content) return;
    
    const contentLower = attachment.content.toLowerCase();
    const contentLines = attachment.content.split('\n');
    
    // Calculate relevance score based on term matches
    let relevanceScore = 0;
    let matchingSnippets = [];
    
    queryTerms.forEach(term => {
      if (contentLower.includes(term)) {
        relevanceScore += 1;
        
        // Find snippets containing the term
        contentLines.forEach((line, lineIndex) => {
          if (line.toLowerCase().includes(term)) {
            const contextStart = Math.max(0, lineIndex - 1);
            const contextEnd = Math.min(contentLines.length, lineIndex + 2);
            const snippet = contentLines.slice(contextStart, contextEnd).join('\n');
            
            matchingSnippets.push({
              snippet: snippet.trim(),
              lineNumber: lineIndex + 1,
              matchedTerm: term
            });
          }
        });
      }
    });
    
    // Normalize relevance score
    relevanceScore = relevanceScore / queryTerms.length;
    
    if (relevanceScore >= minRelevanceScore && matchingSnippets.length > 0) {
      results.push({
        attachmentIndex: index,
        attachmentName: attachment.name || `Attachment ${index + 1}`,
        relevanceScore,
        matchingSnippets: matchingSnippets.slice(0, 3), // Limit snippets per attachment
        contentPreview: attachment.content.substring(0, 200) + (attachment.content.length > 200 ? '...' : ''),
        totalMatches: matchingSnippets.length
      });
    }
  });
  
  // Sort by relevance score and limit results
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return {
    results: results.slice(0, maxResults),
    totalSearched: attachments.length,
    totalMatches: results.length
  };
}

// Helper function to format attachment content for context injection
export function formatAttachmentContext(searchResults, maxChars = 2000) {
  if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
    return null;
  }

  let contextText = '';
  let currentLength = 0;
  
  contextText += '=== RELEVANT ATTACHMENT CONTENT ===\n\n';
  
  searchResults.results.forEach((result, index) => {
    if (currentLength >= maxChars) return;
    
    contextText += `Attachment: ${result.attachmentName}\n`;
    contextText += `Relevance Score: ${(result.relevanceScore * 100).toFixed(1)}%\n`;
    contextText += `${'='.repeat(result.attachmentName.length + 12)}\n\n`;
    
    // Add matching snippets
    result.matchingSnippets.forEach((snippet, snippetIndex) => {
      if (currentLength >= maxChars) return;
      
      const snippetText = `[Line ${snippet.lineNumber}] ${snippet.snippet}\n\n`;
      if (currentLength + snippetText.length <= maxChars) {
        contextText += snippetText;
        currentLength += snippetText.length;
      } else {
        // Add partial content if possible
        const remainingChars = maxChars - currentLength;
        if (remainingChars > 50) {
          contextText += snippet.snippet.substring(0, remainingChars - 10) + '...\n\n';
        }
        return;
      }
    });
    
    contextText += '\n';
  });
  
  contextText += '=== END ATTACHMENT CONTENT ===\n\n';
  
  return {
    contextText,
    attachmentsUsed: searchResults.results.map(r => ({
      name: r.attachmentName,
      relevanceScore: r.relevanceScore,
      snippetsUsed: r.matchingSnippets.length,
      totalMatches: r.totalMatches
    })),
    totalAttachments: searchResults.totalMatches,
    totalLength: currentLength
  };
}

// Helper function to perform semantic search on lecture materials
export async function searchLectureMaterials(lectureId, query, options = {}) {
  const {
    limit = 3,
    minSimilarity = 0.7,
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

// Helper function to check if a query should trigger comprehensive search (attachments + semantic)
export function shouldTriggerComprehensiveSearch(message, lectureMaterials, hasAttachments = false) {
  if (!message) {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  // Question words that indicate information seeking
  const questionWords = [
    'what', 'why', 'how', 'when', 'where', 'which', 'who',
    'explain', 'describe', 'tell me', 'can you', 'could you',
    'help me understand', 'what does', 'what is', 'what are',
    'show me', 'find', 'search', 'look for', 'about'
  ];

  // Academic/content-related keywords
  const academicKeywords = [
    'concept', 'theory', 'principle', 'definition', 'example',
    'formula', 'equation', 'model', 'process', 'method',
    'approach', 'technique', 'strategy', 'solution', 'algorithm',
    'chapter', 'section', 'topic', 'subject', 'material',
    'lecture', 'content', 'information', 'details', 'facts',
    'document', 'file', 'attachment', 'upload', 'reference'
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
  const mentionsSpecificMaterial = lectureMaterials && lectureMaterials.some(material => {
    if (!material.title) return false;
    const materialName = material.title.toLowerCase();
    const nameWithoutExtension = materialName.replace(/\.[^/.]+$/, '');
    return lowerMessage.includes(materialName) || lowerMessage.includes(nameWithoutExtension);
  });

  // Trigger comprehensive search if:
  // 1. There are attachments available (always search when we have attachments)
  // 2. It's a question about academic content
  // 3. It mentions specific materials
  // 4. It's asking for information and we have materials/attachments available
  return hasAttachments || 
         (hasQuestionWords && hasAcademicContent) ||
         mentionsSpecificMaterial ||
         (lowerMessage.includes('?') && (hasAcademicContent || hasAttachments));
}

// Legacy function for backward compatibility - now just calls the comprehensive version
export function shouldTriggerSemanticSearch(message, lectureMaterials) {
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

  // Trigger semantic search if:
  // 1. It's a question about academic content
  // 2. It mentions specific materials
  // 3. It's asking for information and we have materials available
  return (hasQuestionWords && (hasAcademicContent || lectureMaterials.length <= 3)) || 
         mentionsSpecificMaterial ||
         (lowerMessage.includes('?') && hasAcademicContent);
}

// Helper function to format semantic search results for context injection
export function formatSemanticResults(searchResults, maxChars = 3000) {
  if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
    return null;
  }

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

  // Format the context
  contextText += '=== RELEVANT LECTURE MATERIAL CONTEXT ===\n\n';
  
  for (const [materialId, material] of Object.entries(groupedResults)) {
    if (currentLength >= maxChars) break;
    
    contextText += `Material: ${material.materialTitle}\n`;
    contextText += `${'='.repeat(material.materialTitle.length + 10)}\n\n`;
    
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
    
    contextText += '\n';
  }
  
  contextText += '=== END LECTURE MATERIAL CONTEXT ===\n\n';
  
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

// Enhanced comprehensive search function that combines attachment content and semantic search
export async function performComprehensiveSearch(lectureId, query, options = {}) {
  const {
    includeAttachments = true,
    includeSemanticSearch = true,
    maxAttachmentResults = 2,
    maxSemanticResults = 2,
    maxTotalChars = 3000
  } = options;

  const results = {
    attachmentResults: null,
    semanticResults: null,
    combinedContext: null,
    summary: {
      totalSources: 0,
      attachmentSources: 0,
      semanticSources: 0,
      totalContextLength: 0
    }
  };

  try {
    // 1. Search attachment content (highest priority)
    if (includeAttachments) {
      console.log('Searching attachment content for query:', query);
      const attachmentData = await fetchAttachmentContent(lectureId);
      
      if (attachmentData.success && attachmentData.attachments.length > 0) {
        const attachmentSearch = searchAttachmentContent(
          attachmentData.attachments, 
          query, 
          { maxResults: maxAttachmentResults }
        );
        
        if (attachmentSearch.results.length > 0) {
          results.attachmentResults = formatAttachmentContext(
            attachmentSearch, 
            Math.floor(maxTotalChars * 0.6) // Give 60% of context space to attachments
          );
          results.summary.attachmentSources = attachmentSearch.results.length;
        }
      }
    }

    // 2. Perform semantic search on processed materials (lower priority)
    if (includeSemanticSearch) {
      console.log('Performing semantic search for query:', query);
      const semanticSearch = await searchLectureMaterials(lectureId, query, {
        limit: maxSemanticResults,
        minSimilarity: 0.6
      });
      
      if (semanticSearch && semanticSearch.results && semanticSearch.results.length > 0) {
        const remainingChars = maxTotalChars - (results.attachmentResults?.totalLength || 0);
        results.semanticResults = formatSemanticResults(
          semanticSearch, 
          Math.max(remainingChars, 1000) // Ensure at least 1000 chars for semantic
        );
        results.summary.semanticSources = semanticSearch.results.length;
      }
    }

    // 3. Combine contexts with proper prioritization
    if (results.attachmentResults || results.semanticResults) {
      let combinedText = '';
      const attachmentsUsed = [];
      
      // Add attachment context first (highest priority)
      if (results.attachmentResults) {
        combinedText += results.attachmentResults.contextText;
        attachmentsUsed.push(...results.attachmentResults.attachmentsUsed.map(att => ({
          ...att,
          source: 'attachment',
          priority: 'high'
        })));
      }
      
      // Add semantic context second (lower priority)
      if (results.semanticResults) {
        combinedText += results.semanticResults.contextText;
        attachmentsUsed.push(...results.semanticResults.materialsUsed.map(mat => ({
          name: mat.materialTitle,
          source: 'semantic',
          priority: 'medium',
          chunksUsed: mat.chunksUsed,
          avgSimilarity: mat.similarities.reduce((a,b) => a+b, 0) / mat.similarities.length
        })));
      }
      
      results.combinedContext = {
        contextText: combinedText,
        sourcesUsed: attachmentsUsed,
        totalLength: combinedText.length,
        hasAttachmentContent: !!results.attachmentResults,
        hasSemanticContent: !!results.semanticResults
      };
      
      results.summary.totalSources = attachmentsUsed.length;
      results.summary.totalContextLength = combinedText.length;
    }

    console.log(`Comprehensive search completed: ${results.summary.totalSources} sources found`);
    return results;
    
  } catch (error) {
    console.error('Error in comprehensive search:', error);
    return {
      ...results,
      error: error.message
    };
  }
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
