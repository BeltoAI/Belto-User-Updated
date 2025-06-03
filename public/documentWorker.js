// Web Worker for document processing with memory optimizations

// Maximum number of iterations to prevent infinite loops
const MAX_ITERATIONS = 10000;

// Implement the text chunking function within the worker with memory optimizations
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text) return [];
  
  const chunks = [];
  let i = 0;
  let iterations = 0;
  const textLength = text.length;
  
  // Process in batches to prevent memory issues
  const processBatch = (startIndex, endIndex) => {
    let currentIndex = startIndex;
    
    while (currentIndex < endIndex && iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Send progress updates less frequently to reduce overhead
      if (iterations % 20 === 0) {
        self.postMessage({
          type: 'progress',
          progress: Math.min(100, Math.round((currentIndex / textLength) * 100))
        });
      }
      
      // Calculate end position with overlap
      let end = Math.min(currentIndex + chunkSize, textLength);
      
      // Find a good breaking point (sentence or paragraph)
      if (end < textLength) {
        // Only search a limited window to improve performance
        const searchWindow = text.substring(Math.max(end - 50, currentIndex), Math.min(end + 50, textLength));
        const nextBreak = searchWindow.search(/[.!?]\s/);
        if (nextBreak > 0) {
          end = Math.max(end - 50, currentIndex) + nextBreak + 2; // +2 to include the punctuation and space
        }
      }
      
      // Add the chunk with optimized metadata
      chunks.push({
        content: text.substring(currentIndex, end).trim(),
        metadata: {
          startChar: currentIndex,
          endChar: end
        }
      });
      
      // Safety check: ensure we're making progress
      if (end <= currentIndex) {
        currentIndex = currentIndex + chunkSize; // Force progress
      } else {
        // Move to next chunk position, considering overlap
        currentIndex = end - overlap;
      }
    }
  };  
  // Process the text in manageable batches to prevent memory spikes
  const BATCH_SIZE = 100000; // 100KB batches
  let startIndex = 0;
  
  while (startIndex < textLength) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, textLength);
    processBatch(startIndex, endIndex);
    startIndex = endIndex;
    
    // Force garbage collection-friendly behavior by yielding to the event loop
    if (startIndex < textLength) {
      // This gives the browser a chance to clean up memory between batches
      self.postMessage({
        type: 'progress',
        progress: Math.min(95, Math.round((startIndex / textLength) * 100)),
        message: 'Processing large document in batches...'
      });
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    console.warn('Maximum chunking iterations reached, document may be incompletely processed');
  }
  
  return chunks;
}

// Process document and create chunks with document metadata
function processDocumentText(text, fileInfo) {
  if (!text || !text.trim()) {
    throw new Error('No content to process');
  }
  
  // Limit excessive large documents
  const MAX_TEXT_LENGTH = 1000000; // ~1MB text limit
  if (text.length > MAX_TEXT_LENGTH) {
    console.warn(`Document text exceeds ${MAX_TEXT_LENGTH} characters, truncating for performance`);
    text = text.substring(0, MAX_TEXT_LENGTH);
  }
    // Generate a document ID
  const documentId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  // Create chunks with optimized parameters based on document type
  const optimalChunkSize = determineOptimalChunkSize(fileInfo.type, text.length);
  const chunks = chunkText(text, optimalChunkSize.size, optimalChunkSize.overlap);
  
  // Create document object with metadata but without storing the full text to save memory
  return {
    id: documentId,
    filename: fileInfo.name,
    type: fileInfo.type,
    createdAt: new Date().toISOString(),
    totalChunks: chunks.length,
    textLength: text.length,
    textPreview: text.substring(0, 500) + (text.length > 500 ? '...' : ''), // Only store a preview
    chunks: chunks.map((chunk, index) => ({
      id: `${documentId}-chunk-${index}`,
      index,
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        source: fileInfo.name,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }))
  };
}

// Helper function to determine optimal chunk size based on document type and length
function determineOptimalChunkSize(fileType, textLength) {
  // Default values
  let size = 1000;
  let overlap = 200;
  
  // Adjust based on file type
  if (fileType.includes('pdf')) {
    // PDFs often have more structure, can use larger chunks
    size = 1500;
    overlap = 250;
  } else if (fileType.includes('doc') || fileType.includes('word')) {
    // Word docs often have semantic sections
    size = 1200;
    overlap = 200;
  } else if (textLength > 500000) {
    // For very large documents, use larger chunks with less overlap
    size = 2000;
    overlap = 200;
  } else if (textLength < 50000) {
    // For small documents, use smaller chunks with more overlap
    size = 800; 
    overlap = 200;
  }
  
  return { size, overlap };
}

// Listen for messages from main thread with memory optimizations
self.onmessage = function(e) {
  // Track memory usage and performance
  const startTime = performance.now();
  let memoryUsed = 0;
  
  // If available, get memory info
  if (self.performance && self.performance.memory) {
    memoryUsed = self.performance.memory.usedJSHeapSize;
  }
  
  try {
    const { text, fileInfo, options } = e.data;
    
    // Send initial progress
    self.postMessage({
      type: 'progress',
      progress: 0,
      message: `Starting document processing...`
    });
    
    // Process the document text with timeout protection
    const processingTimeout = setTimeout(() => {
      self.postMessage({
        type: 'error',
        error: 'Document processing took too long and was terminated'
      });
    }, 60000); // 60 second timeout
    
    const processedDocument = processDocumentText(text, fileInfo);
    clearTimeout(processingTimeout);
    
    // Calculate performance metrics
    const endTime = performance.now();
    let endMemoryUsed = 0;
    if (self.performance && self.performance.memory) {
      endMemoryUsed = self.performance.memory.usedJSHeapSize;
    }
    
    // Send the result back to the main thread
    self.postMessage({
      type: 'complete',
      processedDocument,
      metrics: {
        processingTimeMs: endTime - startTime,
        memoryUsageMB: ((endMemoryUsed - memoryUsed) / (1024 * 1024)).toFixed(2)
      }
    });
    
    // Explicitly help garbage collection
    setTimeout(() => {
      // Clear large variables
      const clearMemory = () => {
        processedDocument.chunks = null;
        processedDocument.textPreview = null;
      };
      clearMemory();
    }, 1000);
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
  }
};