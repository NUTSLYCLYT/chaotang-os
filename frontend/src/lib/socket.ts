'use client';
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const base = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    _socket = io(`${base}/ws`, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnectionAttempts: 3,   // 最多重试 3 次，不无限打
      reconnectionDelay: 5000,
      timeout: 8000,
    });
  }
  return _socket;
}
