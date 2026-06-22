import { Injectable } from '@nestjs/common';

const BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bGoogle(?:\s+Gemini)?\b/gi, '3elagi'],
  [/\bGemini\b/gi, '3elagi'],
  [/\bAlphabet\b/gi, '3elagi'],
  [/\bOpenAI\b/gi, '3elagi'],
  [/\bChatGPT\b/gi, '3elagi'],
];

export interface AiLinkEntry {
  label: string;
  path: string;
  kind: 'medical_record' | 'doctor_profile';
}

@Injectable()
export class AiResponseService {
  sanitizeBranding(text: string): string {
    let next = text;
    for (const [pattern, replacement] of BRAND_REPLACEMENTS) {
      next = next.replace(pattern, replacement);
    }
    return next;
  }

  buildLinkCatalog(links: AiLinkEntry[]): string {
    if (!links.length) return '';
    const lines = [
      '[Clickable links — use markdown when mentioning these in your answer]',
      'Format: [visible text](path)',
      'Example: [Migraine diagnosis](/medical/abc-123)',
    ];
    for (const link of links) {
      lines.push(`- ${link.label} → [${link.label}](${link.path})`);
    }
    return lines.join('\n');
  }

  collectLinksFromRecords(input: {
    diagnoses: Array<{ id: string; title: string }>;
    documents: Array<{ id: string; title: string }>;
    doctors: Array<{ id: string; name: string }>;
  }): AiLinkEntry[] {
    const links: AiLinkEntry[] = [];
    const seen = new Set<string>();

    for (const diagnosis of input.diagnoses) {
      const path = `/medical/${diagnosis.id}`;
      if (seen.has(path)) continue;
      seen.add(path);
      links.push({
        label: diagnosis.title,
        path,
        kind: 'medical_record',
      });
    }

    for (const document of input.documents) {
      const path = `/medical/${document.id}`;
      if (seen.has(path)) continue;
      seen.add(path);
      links.push({
        label: document.title,
        path,
        kind: 'medical_record',
      });
    }

    for (const doctor of input.doctors) {
      const path = `/doctor/${doctor.id}`;
      if (seen.has(path)) continue;
      seen.add(path);
      links.push({
        label: `Dr ${doctor.name}`,
        path,
        kind: 'doctor_profile',
      });
    }

    return links;
  }

  enrichWithLinks(text: string, links: AiLinkEntry[]): string {
    if (!links.length) return text;

    let enriched = text;
    for (const link of links) {
      if (enriched.includes(link.path)) continue;
      const escaped = link.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const plain = new RegExp(`(?<!\\[)${escaped}(?!\\])`, 'i');
      if (!plain.test(enriched)) continue;
      enriched = enriched.replace(plain, `[${link.label}](${link.path})`);
    }
    return enriched;
  }
}
