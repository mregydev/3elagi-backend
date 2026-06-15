import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import type { LoggedInUser } from './presence.types';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class PresenceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly presence: PresenceService) {}

  private broadcastPresence(): void {
    this.server.emit('presence:sync', { users: this.presence.getAll() });
  }

  @SubscribeMessage('user:loggedIn')
  handleLoggedIn(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoggedInUser,
  ) {
    if (!payload?.id || !payload?.name || !payload?.role) return;

    const user: LoggedInUser = {
      id: payload.id,
      name: payload.name,
      role: payload.role,
      email: payload.email,
      photo_url: payload.photo_url ?? null,
      specialty: payload.specialty ?? null,
      speciality_id: payload.speciality_id ?? null,
      doctor_id: payload.doctor_id ?? null,
    };

    const wasOnline = this.presence.isUserOnline(user.id);
    this.presence.login(client.id, user);
    if (!wasOnline) {
      this.server.emit('newlogin', user);
    }
    client.emit('loggedIn:users', this.presence.getAll());
    this.broadcastPresence();
  }

  @SubscribeMessage('user:loggedOut')
  handleLoggedOut(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id?: string },
  ) {
    const userId = payload?.id ?? this.presence.getUserIdForSocket(client.id);
    if (!userId) return;

    const removed = this.presence.logoutByUserId(userId);
    if (removed) {
      this.server.emit('newlogout', removed);
      this.broadcastPresence();
    }
  }

  @SubscribeMessage('get:loggedIn:users')
  handleGetLoggedInUsers(@ConnectedSocket() client: Socket) {
    client.emit('loggedIn:users', this.presence.getAll());
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @MessageBody() payload: { recipient_id?: string; user_id?: string },
  ) {
    if (!payload?.recipient_id || !payload?.user_id) return;
    this.emitToUser(payload.recipient_id, 'chat:typing', {
      peer_id: payload.user_id,
    });
  }

  @SubscribeMessage('chat:stopTyping')
  handleChatStopTyping(
    @MessageBody() payload: { recipient_id?: string; user_id?: string },
  ) {
    if (!payload?.recipient_id || !payload?.user_id) return;
    this.emitToUser(payload.recipient_id, 'chat:stopTyping', {
      peer_id: payload.user_id,
    });
  }

  handleDisconnect(client: Socket) {
    const removed = this.presence.logout(client.id);
    if (removed) {
      this.server.emit('newlogout', removed);
      this.broadcastPresence();
    }
  }

  /** Notify all connected clients that a doctor is now listed under a speciality. */
  broadcastDoctorRegistered(payload: unknown): void {
    this.server.emit('doctor:registered', payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    const socketIds = this.presence.getSocketIdsForUser(userId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, payload);
    }
  }
}
