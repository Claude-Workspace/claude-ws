'use client';

/**
 * Example usage of ChunkedUploader with progress tracking
 * This component demonstrates how to integrate chunked upload with progress UI
 */

import { useState } from 'react';
import { ChunkedUploadProgress } from './chunked-upload-progress';
import { ChunkedUploader, ChunkUploadProgress } from '@/lib/chunked-uploader';

export function ChunkedUploadExample() {
  const [uploadProgress, setUploadProgress] = useState<ChunkUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(null);

    // Initialize chunked uploader
    const uploader = new ChunkedUploader({
      apiUrl: '/api/uploads/chunk',
      onProgress: (progress) => {
        setUploadProgress(progress);
      },
      onChunkComplete: (chunkIndex) => {
        console.log(`Chunk ${chunkIndex} uploaded`);
      },
      onChunkFailed: (chunkIndex, error) => {
        console.error(`Chunk ${chunkIndex} failed:`, error);
      },
    });

    try {
      // Start upload
      const uploadId = await uploader.upload(file);
      console.log('Upload complete:', uploadId);

      // TODO: Move file from temp reassembled location to final destination
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File input */}
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        disabled={isUploading}
      />

      {/* Progress display */}
      {uploadProgress && (
        <ChunkedUploadProgress
          fileName={uploadProgress.fileName}
          progress={uploadProgress.progress}
          uploadedChunks={uploadProgress.uploadedChunks}
          totalChunks={uploadProgress.totalChunks}
          uploadSpeed={uploadProgress.uploadSpeed}
          eta={uploadProgress.eta}
          isComplete={uploadProgress.progress === 100}
        />
      )}
    </div>
  );
}
