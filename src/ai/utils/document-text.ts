export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isSupportedDocMime(mime: string): boolean {
  return mime === 'application/pdf' || mime === DOCX_MIME;
}

/** Extract plain text from a PDF or DOCX buffer (returns '' for anything else). */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === 'application/pdf') {
    const mod = await import('pdf-parse');
    const parser = new (mod as { PDFParse: new (opts: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => Promise<void>;
    } }).PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text ?? '';
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
  if (mimeType === DOCX_MIME) {
    const mammoth = await import('mammoth');
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value ?? '';
  }
  return '';
}
