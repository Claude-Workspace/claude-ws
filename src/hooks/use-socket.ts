import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '@/lib/logger';

const log = createLogger('SocketHook');

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
      log.debug({ socketId: socket.id }, 'Socket connected');
    });

    socket.on('disconnect', () => {
      log.debug('Socket disconnected');
    });

    socket.on('error', (error) => {
      log.error({ error }, 'Socket error');
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
