import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTaskStore } from '@/stores/task-store';
import type { Task } from '@/types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket connection
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Handle SDK task creation events
    socket.on('task:created', (task: Task) => {
      console.log('[Socket] Task created event received:', task);
      useTaskStore.getState().addTask(task);
    });

    // Handle SDK task update events
    socket.on('task:updated', ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      console.log('[Socket] Task updated event received:', taskId, updates);
      useTaskStore.getState().updateTask(taskId, updates);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
