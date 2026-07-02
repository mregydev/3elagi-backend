import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '../entities/medical-document.entity';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';
import { normalizeMedicalAiInsight } from '../common/medical-ai-insight.types';

export interface AnalyzedMedicalRecordImage {
  type: DocumentType.LAB | DocumentType.XRAY;
  title: string;
  notes: string;
  ai_insight: MedicalAiInsight;
}

const DEFAULT_CHAT_MODEL = 'gemini-3-flash-preview';

function buildAnalysisPrompt(outputLang: 'ar' | 'en'): string {
  const langLabel = outputLang === 'ar' ? 'Arabic (Egyptian)' : 'English';
  return `You analyze medical images for a patient health app (lab reports, blood tests, X-rays, CT, MRI, ultrasound scans).

Classify the image as either "lab" (laboratory / blood / urine / pathology report) or "xray" (imaging: X-ray, CT, MRI, ultrasound, scan).

Return ONLY valid JSON (no markdown) shaped like:
{
  "type": "lab" or "xray",
  "title": "Short record title in ${langLabel}",
  "notes": "Brief factual description of what the image shows in ${langLabel}",
  "ai_insight": {
    "description": "One short plain-language sentence summarizing the record in ${langLabel}",
    "possible_diseases": "One short sentence listing possible conditions or findings to discuss with a doctor — use cautious language (may suggest, could indicate), never a definitive diagnosis, in ${langLabel}"
  }
}

Rules:
- Base everything only on what is visible in the image.
- Do not invent values not shown.
- Never prescribe treatment.
- possible_diseases must stay non-diagnostic and encourage seeing a doctor.
- If unreadable, still return best-effort JSON with type "lab" and note uncertainty in notes.`;
}

@Injectable()
export class MedicalRecordImageAnalyzerService {
  private readonly logger = new Logger(MedicalRecordImageAnalyzerService.name);
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.modelName =
      this.config.get<string>('GEMINI_CHAT_MODEL') ?? DEFAULT_CHAT_MODEL;
  }

  async analyzeImage(
    imageBase64: string,
    mimeType: string,
    outputLang: 'ar' | 'en' = 'en',
  ): Promise<AnalyzedMedicalRecordImage> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    if (!imageBase64?.trim()) {
      throw new BadRequestException('Image data is required');
    }

    const normalizedMime = mimeType?.trim() || 'image/jpeg';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });

    try {
      const result = await model.generateContent([
        { text: buildAnalysisPrompt(outputLang) },
        {
          inlineData: {
            mimeType: normalizedMime,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        },
      ]);

      const raw = result.response.text().trim();
      const jsonText = this.extractJsonObject(raw);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      return this.normalizeResult(parsed);
    } catch (err) {
      this.logger.warn(
        `Medical image analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'Could not analyze this medical image. Try a clearer photo.',
      );
    }
  }

  async analyzeFromTextContext(input: {
    title: string;
    notes?: string | null;
    recordType: string;
    outputLang?: 'ar' | 'en';
  }): Promise<MedicalAiInsight> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    const outputLang = input.outputLang ?? 'en';
    const langLabel = outputLang === 'ar' ? 'Arabic (Egyptian)' : 'English';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const prompt = `You summarize a medical record for a patient app.

Record type: ${input.recordType}
Title: ${input.title}
Notes: ${input.notes?.trim() || 'None'}

Return ONLY JSON:
{
  "description": "One short summary sentence in ${langLabel}",
  "possible_diseases": "One short cautious sentence about possible conditions to discuss with a doctor in ${langLabel}"
}

Never give a definitive diagnosis.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonText = this.extractJsonObject(raw);
    const parsed = JSON.parse(jsonText) as unknown;
    const insight = normalizeMedicalAiInsight(parsed);
    if (!insight) {
      throw new BadRequestException('Could not generate AI insight');
    }
    return insight;
  }

  private extractJsonObject(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return text.slice(start, end + 1);
    return text;
  }

  private normalizeResult(parsed: Record<string, unknown>): AnalyzedMedicalRecordImage {
    const typeRaw = String(parsed.type ?? 'lab').toLowerCase();
    const type =
      typeRaw === 'xray' || typeRaw === 'imaging' || typeRaw === 'scan'
        ? DocumentType.XRAY
        : DocumentType.LAB;
    const title = String(parsed.title ?? '').trim() || 'Medical record';
    const notes = String(parsed.notes ?? parsed.description ?? '').trim() || title;
    const insight =
      normalizeMedicalAiInsight(parsed.ai_insight ?? parsed.insight) ?? {
        description: notes.slice(0, 200),
        possible_diseases:
          'Discuss these findings with your doctor for proper interpretation.',
      };

    return { type, title, notes, ai_insight: insight };
  }
}
