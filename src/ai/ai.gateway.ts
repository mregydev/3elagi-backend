import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AiService } from './ai.service';

interface AiChatPayload {
  message: string;
  conversationId?: string;
  patientUserId?: string;
  userId: string;
  role: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class AiGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly aiService: AiService) {}

  @SubscribeMessage('ai:chat')
  async handleAiChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AiChatPayload,
  ) {
    if (!payload?.message?.trim() || !payload.userId || !payload.role) {
      client.emit('ai:error', { error: 'Invalid AI chat payload' });
      return;
    }

    try {
      for await (const event of this.aiService.streamChat(
        { id: payload.userId, role: payload.role },
        payload.message.trim(),
        payload.conversationId,
        payload.patientUserId,
      )) {
        if (event.type === 'token') {
          client.emit('ai:token', { content: event.content });
        } else if (event.type === 'done') {
          client.emit('ai:done', {
            conversationId: event.conversationId,
            messageId: event.messageId,
          });
        } else if (event.type === 'error') {
          client.emit('ai:error', { error: event.error });
        }
      }
    } catch (err) {
      client.emit('ai:error', {
        error: err instanceof Error ? err.message : 'AI request failed',
      });
    }
  }
}
