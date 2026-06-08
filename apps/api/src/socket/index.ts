import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@devpulse/types';
import { loadEnv } from '../config/env';

const env = loadEnv();

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    path: '/socket.io',
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      if (!payload.orgId) {
        next(new Error('No org selected'));
        return;
      }
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    const orgRoom = `org:${user.orgId}`;
    socket.join(orgRoom);

    socket.on('disconnect', () => {
      socket.leave(orgRoom);
    });
  });

  return io;
}

export function emitToOrg(orgId: string, event: unknown): void {
  io?.to(`org:${orgId}`).emit('realtime', event);
}

export function getIO(): Server | null {
  return io;
}
