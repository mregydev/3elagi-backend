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
    };

    const isNew = this.presence.login(client.id, user);
    if (isNew) {
      this.server.emit('newlogin', user);
    }
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
    }
  }

  @SubscribeMessage('get:loggedIn:users')
  handleGetLoggedInUsers(@ConnectedSocket() client: Socket) {
    client.emit('loggedIn:users', this.presence.getAll());
  }

  handleDisconnect(client: Socket) {
    const removed = this.presence.logout(client.id);
    if (removed) {
      this.server.emit('newlogout', removed);
    }
  }
}
