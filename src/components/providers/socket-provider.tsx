'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRunningTasksStore } from '@/stores/running-tasks-store';

/**
 * Global socket provider that listens for task status updates
 * This ensures task cards show correct status even when task isn't opened
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { addRunningTask, removeRunningTask, markTaskCompleted } = useRunningTasksStore();

  useEffect(() => {
    const socketInstance = io({
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('[SocketProvider] Connected:', socketInstance.id);
      // Defer setSocket to avoid setState during render
      Promise.resolve().then(() => setSocket(socketInstance));
    });

    socketInstance.on('disconnect', () => {
      console.log('[SocketProvider] Disconnected');
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[SocketProvider] Connect error:', err);
    });

    // Global: Listen for any task starting
    socketInstance.on('task:started', (data: { taskId: string }) => {
      console.log('[SocketProvider] Task started:', data.taskId);
      addRunningTask(data.taskId);
    });

    // Global: Listen for any task finishing
    socketInstance.on('task:finished', (data: { taskId: string; status: string }) => {
      console.log('[SocketProvider] Task finished:', data.taskId, data.status);
      removeRunningTask(data.taskId);
      if (data.status === 'completed') {
        markTaskCompleted(data.taskId);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [addRunningTask, removeRunningTask, markTaskCompleted]);

  return <>{children}</>;
}
