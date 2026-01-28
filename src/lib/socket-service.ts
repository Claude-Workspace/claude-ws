/**
 * Socket Service - Singleton socket.io client
 *
 * Provides a persistent socket connection that survives HMR and component remounts.
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Get or create the singleton socket instance
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
    });

    // Prevent HMR from destroying socket
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, Socket>).__INLINE_EDIT_SOCKET__ = socket;
    }
  }

  return socket;
}

/**
 * Initialize socket from window if available (after HMR)
 */
if (typeof window !== 'undefined') {
  const existingSocket = (window as unknown as Record<string, Socket>).__INLINE_EDIT_SOCKET__;
  if (existingSocket && existingSocket.connected) {
    socket = existingSocket;
  }
}
