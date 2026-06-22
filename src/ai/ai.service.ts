import { Injectable } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';

/** @deprecated Use AiChatService directly. Kept for KnowledgeIndexerService and exports. */
@Injectable()
export class AiService {
  constructor(private readonly chat: AiChatService) {}

  listHistory(userId: string) {
    return this.chat.listHistory(userId);
  }

  deleteConversation(userId: string, conversationId: string) {
    return this.chat.deleteConversation(userId, conversationId);
  }
}
