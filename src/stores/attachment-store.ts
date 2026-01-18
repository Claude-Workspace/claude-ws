import { create } from 'zustand';
import type { PendingFile } from '@/types';

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB per attempt

interface AttachmentState {
  // State: Map of taskId -> PendingFile[]
  pendingFilesByTask: Record<string, PendingFile[]>;

  // Actions
  getPendingFiles: (taskId: string) => PendingFile[];
  addFiles: (taskId: string, files: File[]) => Promise<void>;
  removeFile: (taskId: string, tempId: string) => Promise<void>;
  clearFiles: (taskId: string) => void;
  retryUpload: (taskId: string, tempId: string) => Promise<void>;
  getTotalSize: (taskId: string) => number;
  getUploadedFileIds: (taskId: string) => string[];
  hasUploadingFiles: (taskId: string) => boolean;
  moveFiles: (fromTaskId: string, toTaskId: string) => void;
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
  pendingFilesByTask: {},

  getPendingFiles: (taskId) => {
    return get().pendingFilesByTask[taskId] || [];
  },

  addFiles: async (taskId, files) => {
    // Check total size limit
    const currentTotal = get().getTotalSize(taskId);
    const newTotal = files.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + newTotal > MAX_TOTAL_SIZE) {
      throw new Error('Total file size exceeds 50MB limit');
    }

    // Create pending entries with preview URLs for images
    const pending: PendingFile[] = files.map((file) => ({
      tempId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      previewUrl: file.type?.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
      status: 'pending' as const,
      file,
    }));

    // Add to state immediately (optimistic)
    set((state) => ({
      pendingFilesByTask: {
        ...state.pendingFilesByTask,
        [taskId]: [...(state.pendingFilesByTask[taskId] || []), ...pending],
      },
    }));

    // Upload each file
    for (const pendingFile of pending) {
      await uploadFile(taskId, pendingFile, set, get);
    }
  },

  removeFile: async (taskId, tempId) => {
    const files = get().pendingFilesByTask[taskId] || [];
    const file = files.find((f) => f.tempId === tempId);

    if (file) {
      // Revoke object URL to free memory
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }

      // Delete from server if uploaded (has server-assigned tempId)
      if (file.status === 'uploaded' && !file.tempId.startsWith('local-')) {
        try {
          await fetch(`/api/uploads/${file.tempId}`, { method: 'DELETE' });
        } catch (e) {
          console.error('Failed to delete file from server:', e);
        }
      }
    }

    // Remove from state
    set((state) => ({
      pendingFilesByTask: {
        ...state.pendingFilesByTask,
        [taskId]: (state.pendingFilesByTask[taskId] || []).filter(
          (f) => f.tempId !== tempId
        ),
      },
    }));
  },

  clearFiles: (taskId) => {
    // Note: We intentionally don't revoke previewUrls here because they may still
    // be in use for rendering during streaming. The blob URLs will be garbage
    // collected when the page reloads or the File objects are dereferenced.

    set((state) => {
      const updated = { ...state.pendingFilesByTask };
      delete updated[taskId];
      return { pendingFilesByTask: updated };
    });
  },

  retryUpload: async (taskId, tempId) => {
    const files = get().pendingFilesByTask[taskId] || [];
    const file = files.find((f) => f.tempId === tempId);

    if (file?.file && file.status === 'error') {
      // Reset status
      set((state) => ({
        pendingFilesByTask: {
          ...state.pendingFilesByTask,
          [taskId]: (state.pendingFilesByTask[taskId] || []).map((f) =>
            f.tempId === tempId
              ? { ...f, status: 'pending' as const, error: undefined }
              : f
          ),
        },
      }));

      await uploadFile(taskId, file, set, get);
    }
  },

  getTotalSize: (taskId) => {
    const files = get().pendingFilesByTask[taskId] || [];
    return files.reduce((sum, f) => sum + f.size, 0);
  },

  getUploadedFileIds: (taskId) => {
    const files = get().pendingFilesByTask[taskId] || [];
    return files
      .filter((f) => f.status === 'uploaded' && !f.tempId.startsWith('local-'))
      .map((f) => f.tempId);
  },

  hasUploadingFiles: (taskId) => {
    const files = get().pendingFilesByTask[taskId] || [];
    return files.some((f) => f.status === 'uploading' || f.status === 'pending');
  },

  moveFiles: (fromTaskId, toTaskId) => {
    const files = get().pendingFilesByTask[fromTaskId] || [];
    if (files.length === 0) return;

    set((state) => {
      const updated = { ...state.pendingFilesByTask };
      // Move files to new task ID
      updated[toTaskId] = [...(updated[toTaskId] || []), ...files];
      // Clear old task ID
      delete updated[fromTaskId];
      return { pendingFilesByTask: updated };
    });
  },
}));

// Helper: Upload single file to server
async function uploadFile(
  taskId: string,
  pendingFile: PendingFile,
  set: (fn: (state: AttachmentState) => Partial<AttachmentState>) => void,
  _get: () => AttachmentState
) {
  if (!pendingFile.file) return;

  const localTempId = pendingFile.tempId;

  // Update status to uploading
  set((state: AttachmentState) => ({
    pendingFilesByTask: {
      ...state.pendingFilesByTask,
      [taskId]: (state.pendingFilesByTask[taskId] || []).map((f) =>
        f.tempId === localTempId ? { ...f, status: 'uploading' as const } : f
      ),
    },
  }));

  try {
    const formData = new FormData();
    formData.append('files', pendingFile.file);

    const res = await fetch('/api/uploads', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Upload failed: ${res.statusText}`);
    }

    const data = await res.json();
    const uploaded = data.files[0];

    // Update with server-assigned tempId
    set((state: AttachmentState) => ({
      pendingFilesByTask: {
        ...state.pendingFilesByTask,
        [taskId]: (state.pendingFilesByTask[taskId] || []).map((f) =>
          f.tempId === localTempId
            ? {
                ...f,
                tempId: uploaded.tempId,
                status: 'uploaded' as const,
                file: undefined, // Clear File object to save memory
              }
            : f
        ),
      },
    }));
  } catch (error: any) {
    // Update with error status
    set((state: AttachmentState) => ({
      pendingFilesByTask: {
        ...state.pendingFilesByTask,
        [taskId]: (state.pendingFilesByTask[taskId] || []).map((f) =>
          f.tempId === localTempId
            ? { ...f, status: 'error' as const, error: error.message }
            : f
        ),
      },
    }));
  }
}
