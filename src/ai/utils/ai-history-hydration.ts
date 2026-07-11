import type { AiMessage } from '../../entities/ai-message.entity';
import type { UploadsService } from '../../uploads/uploads.service';
import type { LlmMessage } from '../llm/llm.types';

const ATTACHED_DOC_MARKER = '[Attached document contents]';
/** Max user turns in LLM context (user + assistant pairs). */
export const AI_HISTORY_MESSAGE_LIMIT = 30;
/** Cap re-attached files so multimodal context stays bounded. */
const MAX_HISTORY_ATTACHMENTS = 6;

type HistoryRow = Pick<
  AiMessage,
  'role' | 'content' | 'attachment_url' | 'attachment_mime_type'
>;

function shouldReattachFile(row: HistoryRow): boolean {
  if (!row.attachment_url?.trim() || !row.attachment_mime_type?.trim()) {
    return false;
  }
  const mime = row.attachment_mime_type.toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') {
    return !row.content.includes(ATTACHED_DOC_MARKER);
  }
  return false;
}

/** Re-load stored files for earlier user turns so follow-up questions still see them. */
export async function hydrateHistoryForLlm(
  rows: HistoryRow[],
  uploads: UploadsService,
): Promise<LlmMessage[]> {
  const attachmentIndexes = new Set<number>();
  let slots = 0;
  for (let i = rows.length - 1; i >= 0 && slots < MAX_HISTORY_ATTACHMENTS; i -= 1) {
    const row = rows[i];
    if (row.role !== 'user' || !shouldReattachFile(row)) continue;
    attachmentIndexes.add(i);
    slots += 1;
  }

  const out: LlmMessage[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.role === 'assistant') {
      out.push({ role: 'assistant', content: row.content });
      continue;
    }

    if (
      attachmentIndexes.has(i) &&
      row.attachment_url &&
      row.attachment_mime_type
    ) {
      const buffer = await uploads.getBufferFromUrl(row.attachment_url);
      if (buffer?.length) {
        out.push({
          role: 'user',
          content: row.content,
          attachment: {
            data: buffer.toString('base64'),
            mimeType: row.attachment_mime_type,
          },
        });
        continue;
      }
    }

    out.push({ role: 'user', content: row.content });
  }

  return out;
}
