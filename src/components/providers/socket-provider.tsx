'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRunningTasksStore } from '@/stores/running-tasks-store';
import { useTaskStore } from '@/stores/task-store';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

/**
 * Global socket provider that listens for task status updates
 * This ensures task cards show correct status even when task isn't opened
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const t = useTranslations('chat');
  // Track completed tasks to prevent duplicate notifications
  const completedTasksRef = useState<Set<string>>(() => new Set())[0];

  useEffect(() => {
    const socketInstance = io({
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      // Defer setSocket to avoid setState during render
      Promise.resolve().then(() => setSocket(socketInstance));
    });

    socketInstance.on('disconnect', () => {
      // Socket disconnected
    });

    socketInstance.on('connect_error', () => {
      // Socket connect error
    });

    // Global: Listen for any task starting
    socketInstance.on('task:started', (data: { taskId: string }) => {
      useRunningTasksStore.getState().addRunningTask(data.taskId);
      // Clear completed flag when task restarts
      completedTasksRef.delete(data.taskId);
    });

    // Global: Listen for any task finishing
    socketInstance.on('task:finished', (data: { taskId: string; status: string }) => {
      useRunningTasksStore.getState().removeRunningTask(data.taskId);
      if (data.status === 'completed') {
        useRunningTasksStore.getState().markTaskCompleted(data.taskId);

        // Move task to in_review and show notification (only once per completion)
        if (!completedTasksRef.has(data.taskId)) {
          completedTasksRef.add(data.taskId);

          // Move to in_review
          useTaskStore.getState().updateTaskStatus(data.taskId, 'in_review');

          // Show notification
          toast.success(t('taskCompleted'), {
            description: t('movedToReview'),
          });
        }
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [t]);

  return <>{children}</>;
}
