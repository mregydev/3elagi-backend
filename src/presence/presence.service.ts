import { Injectable } from '@nestjs/common';
import type { LoggedInUser } from './presence.types';

@Injectable()
export class PresenceService {
  /** userId → user info */
  private readonly users = new Map<string, LoggedInUser>();
  /** socketId → userId */
  private readonly socketToUser = new Map<string, string>();
  /** userId → connected socket ids */
  private readonly userSockets = new Map<string, Set<string>>();

  login(socketId: string, user: LoggedInUser): boolean {
    const isNew = !this.users.has(user.id);
    this.users.set(user.id, user);
    this.socketToUser.set(socketId, user.id);

    const sockets = this.userSockets.get(user.id) ?? new Set<string>();
    sockets.add(socketId);
    this.userSockets.set(user.id, sockets);

    return isNew;
  }

  logout(socketId: string): LoggedInUser | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return null;

    this.socketToUser.delete(socketId);
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        const removed = this.users.get(userId) ?? null;
        this.users.delete(userId);
        return removed;
      }
    }

    return null;
  }

  logoutByUserId(userId: string): LoggedInUser | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.socketToUser.delete(socketId);
      }
    }
    this.userSockets.delete(userId);
    this.users.delete(userId);
    return user;
  }

  getAll(): LoggedInUser[] {
    return Array.from(this.users.values());
  }

  getUserIdForSocket(socketId: string): string | undefined {
    return this.socketToUser.get(socketId);
  }
}
