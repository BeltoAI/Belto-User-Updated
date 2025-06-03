import React from 'react';

export const LectureMaterials = ({ materials, isLoading, lectureId }) => {  if (isLoading) {
    return (
      <div className="px-4 py-2 text-sm">
        <div className="flex items-center">
          <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-[#FFB800] rounded-full"></div>
          <span className="text-gray-400">Loading materials...</span>
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
  return (
    <div className="mx-4 mb-3 p-2 bg-[#262626] rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[#FFB800]">
          Lecture Materials ({materials.length})
        </div>
      </div>      {/* Materials list */}
      <div className="flex flex-wrap gap-2">
        {materials.map((material, index) => (
          <div 
            key={material._id || index}
            className="text-xs px-2 py-1 rounded flex items-center group bg-[#363636] border border-[#444444] hover:bg-[#404040] cursor-pointer transition-colors"
          >
            <span className="truncate max-w-[120px]" title={material.title}>
              {material.title}
            </span>
            
            {/* Copy suggestion button */}
            <div className="ml-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                className="text-gray-400 hover:text-white p-1"
                title="Copy question suggestion"
                onClick={() => navigator.clipboard.writeText(`Tell me about ${material.title}`)}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
        {/* Help text */}
      <div className="mt-2 text-xs text-gray-400">
        <div>Ask questions naturally about the lecture materials.</div>
        <div className="mt-1">
          Example: &quot;What are the key concepts in lecture 1?&quot; or &quot;Explain the theory from the PDF&quot;
        </div>
      </div>
    </div>
  );
};