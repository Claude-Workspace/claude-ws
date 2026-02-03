'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';

type ChunkStatus = 'pending' | 'uploading' | 'completed' | 'failed';

interface ChunkedUploadProgressProps {
  fileName: string;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  uploadSpeed: string;
  eta: string;
  isComplete: boolean;
}

export function ChunkedUploadProgress({
  fileName,
  progress,
  uploadedChunks,
  totalChunks,
  uploadSpeed,
  eta,
  isComplete,
}: ChunkedUploadProgressProps) {
  const chunks = generateChunkStatus(totalChunks, uploadedChunks);
  const gridColumns = getGridColumns(totalChunks);

  return (
    <Card className="w-full">
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate flex-1" title={fileName}>
              {fileName}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              {isComplete ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className={`grid ${gridColumns} gap-1`}>
          {chunks.map((status, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm transition-all ${getChunkColor(status)}`}
              title={`Chunk ${index + 1}/${totalChunks}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{uploadedChunks} / {totalChunks} chunks</span>
          <div className="flex items-center gap-3">
            <span>{uploadSpeed}</span>
            {!isComplete && <span>{eta}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function generateChunkStatus(totalChunks: number, uploadedChunks: number): ChunkStatus[] {
  return Array.from({ length: totalChunks }, (_, i) =>
    i < uploadedChunks ? 'completed' : 'pending'
  );
}

function getGridColumns(totalChunks: number): string {
  if (totalChunks <= 4) return 'grid-cols-4';
  if (totalChunks <= 8) return 'grid-cols-4';
  if (totalChunks <= 12) return 'grid-cols-6';
  return 'grid-cols-8';
}

function getChunkColor(status: ChunkStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'uploading':
      return 'bg-blue-500 animate-pulse';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-muted';
  }
}
