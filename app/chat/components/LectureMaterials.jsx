import React from 'react';
import { useMaterialProcessing } from '../hooks/useMaterialProcessing';

export const LectureMaterials = ({ materials, isLoading, lectureId }) => {
  const {
    processingStatus,
    isProcessing,
    processMaterial,
    processAllMaterials,
    isFullyProcessed,
    hasUnprocessedMaterials,
    processingPercentage
  } = useMaterialProcessing(lectureId);  if (isLoading || processingStatus.isLoading) {
    return (
      <div className="px-4 py-2 text-sm">
        <div className="flex items-center">
          <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-[#FFB800] rounded-full"></div>
          <span className="text-gray-400">
            {isLoading ? 'Loading materials...' : 'Checking processing status...'}
          </span>
        </div>
      </div>
    );
  }
  if (!materials || materials.length === 0) {
    return (
      <div className="mx-4 mb-3 p-2 bg-[#262626] rounded-md">
        <div className="text-xs font-medium text-gray-400">
          No lecture materials available
        </div>
      </div>
    );
  }

  // Helper function to get material processing status
  const getMaterialStatus = (materialId) => {
    const materialStatus = processingStatus.materials.find(m => m.materialId === materialId);
    return materialStatus || { isProcessed: false, chunksCount: 0 };
  };

  return (
    <div className="mx-4 mb-3 p-2 bg-[#262626] rounded-md">
      {/* Header with overall status */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[#FFB800]">
          Lecture Materials ({materials.length})
        </div>
        
        {/* Processing status indicator */}
        <div className="flex items-center gap-2">
          {processingStatus.totalMaterials > 0 && (
            <div className="text-xs text-gray-400">
              RAG: {processingStatus.processedMaterials}/{processingStatus.totalMaterials}
              {isFullyProcessed && (
                <span className="ml-1 text-green-400">✓</span>
              )}
            </div>
          )}
          
          {/* Process all button */}
          {hasUnprocessedMaterials && (
            <button
              onClick={() => processAllMaterials()}
              disabled={isProcessing}
              className="text-xs px-2 py-1 bg-[#FFB800] text-black rounded hover:bg-[#FFD700] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Process all materials for AI search"
            >
              {isProcessing ? '...' : 'Process All'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar if processing */}
      {processingStatus.totalMaterials > 0 && !isFullyProcessed && (
        <div className="mb-2">
          <div className="w-full bg-[#363636] rounded-full h-1">
            <div 
              className="bg-[#FFB800] h-1 rounded-full transition-all duration-300"
              style={{ width: `${processingPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {processingPercentage}% materials processed for AI search
          </div>
        </div>
      )}

      {/* Materials list */}
      <div className="flex flex-wrap gap-2">
        {materials.map((material, index) => {
          const materialStatus = getMaterialStatus(material._id?.toString() || index.toString());
          const isProcessed = materialStatus.isProcessed;
          
          return (
            <div 
              key={material._id || index}
              className={`text-xs px-2 py-1 rounded flex items-center group relative ${
                isProcessed 
                  ? 'bg-[#363636] border border-green-500/30' 
                  : 'bg-[#363636] border border-yellow-500/30'
              }`}
            >
              {/* Processing status icon */}
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isProcessed ? 'bg-green-400' : 'bg-yellow-400'
              }`} 
              title={isProcessed ? 'Processed for AI search' : 'Not processed for AI search'}
              />
              
              <span className="truncate max-w-[120px]" title={material.title}>
                {material.title}
              </span>
              
              {/* Action buttons */}
              <div className="ml-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Copy suggestion button */}
                <button 
                  className="text-gray-400 hover:text-white p-1"
                  title="Copy question suggestion"
                  onClick={() => navigator.clipboard.writeText(`Tell me about ${material.title}`)}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {/* Process individual material button */}
                {!isProcessed && (
                  <button
                    onClick={() => processMaterial(material._id?.toString() || index.toString())}
                    disabled={isProcessing}
                    className="text-gray-400 hover:text-[#FFB800] p-1 disabled:opacity-50"
                    title="Process this material for AI search"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
                
                {/* Processing status info */}
                {isProcessed && materialStatus.chunksCount > 0 && (
                  <span className="text-xs text-green-400 ml-1" title={`${materialStatus.chunksCount} chunks created`}>
                    ({materialStatus.chunksCount})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Help text */}
      <div className="mt-2 text-xs text-gray-400">
        {isFullyProcessed ? (
          <div className="flex items-center">
            <span className="text-green-400 mr-1">✓</span>
            Materials ready for AI-powered search. Ask questions naturally!
          </div>
        ) : (
          <div>
            <div>Process materials to enable AI-powered search and better responses.</div>            <div className="mt-1">
              Example: &quot;What are the key concepts in lecture 1?&quot; or &quot;Explain the theory from the PDF&quot;
            </div>
          </div>
        )}
      </div>
    </div>
  );
};