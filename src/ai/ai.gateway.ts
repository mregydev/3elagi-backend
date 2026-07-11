import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Logger, ForbiddenException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AiChatService, type AuthUser } from './ai-chat.service';
import { extractDocumentText, isSupportedDocMime } from './utils/document-text';
import {
  AI_RATE_LIMIT_CODE,
  AI_RATE_LIMIT_MESSAGE_EN,
} from './ai.constants';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthUser;
  };
}

@WebSocketGateway({ cors: { origin: '*' } })
export class AiGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AiGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly aiChat: AiChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string; email: string; role: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_SECRET') },
      );
      client.data.user = {
        id: payload.sub,
        role: payload.role,
      };

      const patientRoom = this.aiChat.patientRoomId(
        client.data.user.role === 'patient' ? client.data.user.id : null,
        client.data.user,
      );
      await client.join(`patient:${patientRoom}`);
    } catch {
      client.disconnect(true);
    }
  }

  private requireUser(client: AuthenticatedSocket): AuthUser | null {
    const user = client.data.user;
    if (!user) {
      client.emit('ai:message:error', { error: 'Unauthorized' });
      return null;
    }
    return user;
  }

  private emitChatError(client: AuthenticatedSocket, err: unknown): void {
    if (err instanceof ForbiddenException) {
      client.emit('ai:message:error', {
        error: err.message,
        code: 'insufficient_points',
      });
      return;
    }
    if (
      err instanceof HttpException &&
      err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
    ) {
      client.emit('ai:message:error', {
        error: AI_RATE_LIMIT_MESSAGE_EN,
        code: AI_RATE_LIMIT_CODE,
      });
      return;
    }
    client.emit('ai:message:error', {
      error: err instanceof Error ? err.message : 'AI request failed',
    });
  }

  @SubscribeMessage('ai:chat:create')
  async handleCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { title?: string; patientUserId?: string },
  ) {
    const user = this.requireUser(client);
    if (!user) return;

    try {
      const chat = await this.aiChat.createConversation(
        user,
        body?.title,
        body?.patientUserId,
      );
      await client.join(`ai-chat:${chat.id}`);
      client.emit('ai:chat:created', chat);
    } catch (err) {
      client.emit('ai:message:error', {
        error: err instanceof Error ? err.message : 'Could not create chat',
      });
    }
  }

  @SubscribeMessage('ai:chat:join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { chatId: string },
  ) {
    const user = this.requireUser(client);
    if (!user || !body?.chatId) return;

    await client.join(`ai-chat:${body.chatId}`);
    client.emit('ai:chat:joined', { chatId: body.chatId });
  }

  @SubscribeMessage('ai:chat:history')
  async handleHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = this.requireUser(client);
    if (!user) return;

    try {
      const history = await this.aiChat.listHistory(user.id);
      client.emit('ai:chat:history', { conversations: history });
    } catch (err) {
      client.emit('ai:message:error', {
        error: err instanceof Error ? err.message : 'Could not load history',
      });
    }
  }

  @SubscribeMessage('ai:message:send')
  async handleSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      message: string;
      chatId?: string;
      patientUserId?: string;
      attachment?: { data: string; mimeType: string };
    },
  ) {
    const user = this.requireUser(client);

    // Images go to the model as vision (inlineData); PDF/DOCX are read as text.
    let attachment: { data: string; mimeType: string } | undefined;
    let documentText = '';
    const rawAtt = body?.attachment;
    if (rawAtt?.data && rawAtt.mimeType) {
      const mime = String(rawAtt.mimeType).toLowerCase();
      const data = String(rawAtt.data).replace(/^data:[^;]+;base64,/, '');
      if (data.length > 14_000_000) {
        client.emit('ai:message:error', {
          error: 'Attachment must be under ~10 MB',
        });
        return;
      }
      if (mime.startsWith('image/')) {
        attachment = { data, mimeType: mime };
      } else if (isSupportedDocMime(mime)) {
        try {
          documentText = (
            await extractDocumentText(Buffer.from(data, 'base64'), mime)
          ).trim();
        } catch {
          documentText = '';
        }
        if (!documentText) {
          client.emit('ai:message:error', {
            error: 'Could not read text from the attached document',
          });
          return;
        }
      } else {
        client.emit('ai:message:error', {
          error: 'Attachment must be an image, PDF or DOCX',
        });
        return;
      }
    }

    if (!user || (!body?.message?.trim() && !attachment && !documentText)) {
      client.emit('ai:message:error', { error: 'Invalid message payload' });
      return;
    }

    let messageText =
      body?.message?.trim() ||
      (attachment || documentText ? 'Please review the attachment.' : '');
    if (documentText) {
      // Cap to keep the prompt within limits.
      messageText = `${messageText}\n\n[Attached document contents]\n${documentText.slice(0, 60_000)}`;
    }

    const chatId = body.chatId;
    if (chatId) {
      await client.join(`ai-chat:${chatId}`);
    }

    const room = chatId ? `ai-chat:${chatId}` : undefined;

    try {
      for await (const event of this.aiChat.streamMessage(
        user,
        messageText,
        chatId,
        body.patientUserId,
        attachment,
      )) {
        if (event.type === 'ack') {
          const payload = {
            conversationId: event.conversationId,
            userMessageId: event.userMessageId,
          };
          if (room) {
            this.server.to(room).emit('ai:message:ack', payload);
          } else {
            client.emit('ai:message:ack', payload);
          }
          if (event.conversationId) {
            await client.join(`ai-chat:${event.conversationId}`);
          }
        } else if (event.type === 'token') {
          const payload = { content: event.content, chatId: event.conversationId };
          if (room || event.conversationId) {
            this.server
              .to(`ai-chat:${event.conversationId ?? chatId}`)
              .emit('ai:message:token', payload);
          } else {
            client.emit('ai:message:token', payload);
          }
        } else if (event.type === 'done') {
          const payload = {
            chatId: event.conversationId,
            messageId: event.messageId,
            cacheHit: event.cacheHit,
            content: event.finalContent,
          };
          if (room || event.conversationId) {
            this.server
              .to(`ai-chat:${event.conversationId ?? chatId}`)
              .emit('ai:message:done', payload);
          } else {
            client.emit('ai:message:done', payload);
          }
        } else if (event.type === 'error') {
          client.emit('ai:message:error', {
            error: event.error,
            code: event.code,
          });
        }
      }
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      this.emitChatError(client, err);
    }
  }

  /** @deprecated Use ai:message:send */
  @SubscribeMessage('ai:chat')
  async handleLegacyChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      message: string;
      conversationId?: string;
      patientUserId?: string;
    },
  ) {
    const user = this.requireUser(client);
    if (!user) return;

    for await (const event of this.aiChat.streamMessage(
      user,
      payload.message?.trim() ?? '',
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
  }
}
