"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

export const useMaterialProcessing = (lectureId) => {
  const [processingStatus, setProcessingStatus] = useState({
    isLoading: true,
    totalMaterials: 0,
    processedMaterials: 0,
    totalChunks: 0,
    materials: [],
    lastChecked: null
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Check the processing status of materials
  const checkProcessingStatus = useCallback(async () => {
    if (!lectureId) return;

    try {
      setProcessingStatus(prev => ({ ...prev, isLoading: true }));

      const response = await fetch(`/api/lectures/${lectureId}/materials/search`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check processing status');
      }

      const data = await response.json();
      setProcessingStatus({
        isLoading: false,
        totalMaterials: data.totalMaterials || 0,
        processedMaterials: data.processedMaterials || 0,
        totalChunks: data.totalChunks || 0,
        materials: data.materials || [],
        lastChecked: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error checking processing status:', error);
      setProcessingStatus(prev => ({
        ...prev,
        isLoading: false,
        lastChecked: new Date().toISOString()
      }));
    }
  }, [lectureId]);

  // Process a specific material
  const processMaterial = useCallback(async (materialId, force = false) => {
    if (!lectureId || !materialId) return false;

    try {
      setIsProcessing(true);
      const loadingToast = toast.loading('Processing material...');

      const response = await fetch(`/api/lectures/${lectureId}/materials/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ materialId, force })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process material');
      }

      toast.update(loadingToast, {
        render: `Successfully processed "${data.materialTitle}" (${data.chunksCreated} chunks created)`,
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });

      // Refresh status after processing
      await checkProcessingStatus();
      return true;

    } catch (error) {
      console.error('Error processing material:', error);
      toast.error(`Failed to process material: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [lectureId, checkProcessingStatus]);

  // Process all materials in the lecture
  const processAllMaterials = useCallback(async (force = false) => {
    if (!lectureId) return false;

    try {
      setIsProcessing(true);
      const loadingToast = toast.loading('Processing all materials...');

      const response = await fetch(`/api/lectures/${lectureId}/materials/process`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ force })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process materials');
      }

      const { summary } = data;
      let message = `Processing complete: ${summary.processed} processed, ${summary.errors} errors`;
      if (summary.skipped > 0) {
        message += `, ${summary.skipped} skipped`;
      }

      toast.update(loadingToast, {
        render: message,
        type: summary.errors > 0 ? 'warning' : 'success',
        isLoading: false,
        autoClose: 4000
      });

      // Show detailed results if there were errors
      if (summary.errors > 0) {
        const errorMaterials = data.results.filter(r => r.status === 'error');
        console.error('Materials with processing errors:', errorMaterials);
      }

      // Refresh status after processing
      await checkProcessingStatus();
      return summary.errors === 0;

    } catch (error) {
      console.error('Error processing all materials:', error);
      toast.error(`Failed to process materials: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [lectureId, checkProcessingStatus]);

  // Check status on mount and when lectureId changes
  useEffect(() => {
    checkProcessingStatus();
  }, [checkProcessingStatus]);

  return {
    processingStatus,
    isProcessing,
    checkProcessingStatus,
    processMaterial,
    processAllMaterials,
    // Computed properties for convenience
    isFullyProcessed: processingStatus.totalMaterials > 0 && 
                     processingStatus.processedMaterials === processingStatus.totalMaterials,
    hasUnprocessedMaterials: processingStatus.totalMaterials > processingStatus.processedMaterials,
    processingPercentage: processingStatus.totalMaterials > 0 ? 
                         Math.round((processingStatus.processedMaterials / processingStatus.totalMaterials) * 100) : 0
  };
};
