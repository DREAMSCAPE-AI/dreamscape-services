import { Server as SocketServer } from 'socket.io';

/**
 * Singleton Socket.io service — initialized once in server.ts,
 * used by NotificationService to emit real-time events to users.
 * Avoids circular imports by decoupling io instance from server.ts.
 */
class SocketService {
  private io: SocketServer | null = null;

  initialize(io: SocketServer): void {
    this.io = io;
    console.log('✅ SocketService initialized');
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  isInitialized(): boolean {
    return this.io !== null;
  }
}

export const socketService = new SocketService();
