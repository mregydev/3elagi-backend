import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '../entities/medical-document.entity';
import {
  MEDICAL_BODY_PARTS,
  normalizeBodyPart,
  type MedicalBodyPart,
} from '../common/medical-body-part';
import type { ApiLocale } from '../common/resolve-api-locale';
import { outputLanguageLabel } from '../common/resolve-api-locale';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';
import { normalizeMedicalAiInsight } from '../common/medical-ai-insight.types';

export type AnalyzedDocumentType =
  | DocumentType.LAB
  | DocumentType.XRAY
  | DocumentType.PRESCRIPTION;

export interface AnalyzedMedicalRecordImage {
  type: AnalyzedDocumentType;
  title: string;
  notes: string;
  body_part: MedicalBodyPart;
  ai_insight: MedicalAiInsight;
}

const DEFAULT_CHAT_MODEL = 'gemini-3-flash-preview';

function buildAnalysisPrompt(outputLang: ApiLocale): string {
  const langLabel = outputLanguageLabel(outputLang);
  const bodyParts = MEDICAL_BODY_PARTS.join(', ');
  return `You analyze medical images for a patient health app (lab reports, prescriptions, X-rays, CT, MRI, ultrasound).

Classify the image as one of:
- "lab" — laboratory / blood / urine / pathology report
- "xray" — imaging: X-ray, CT, MRI, ultrasound, scan
- "prescription" — medication prescription / pharmacy script

Return ONLY valid JSON (no markdown) shaped like:
{
  "type": "lab" or "xray" or "prescription",
  "title": "Short record title in ${langLabel}",
  "notes": "Brief factual description of what the image shows in ${langLabel}",
  "body_part": "one of: ${bodyParts}",
  "ai_insight": {
    "description": "One short plain-language sentence summarizing the record in ${langLabel}",
    "possible_diseases": "One short sentence listing possible conditions or findings to discuss with a doctor — use cautious language (may suggest, could indicate), never a definitive diagnosis, in ${langLabel}"
  }
}

Rules:
- Base everything only on what is visible in the image.
- Pick the single most relevant body_part; use "general" if unclear.
- Do not invent values not shown.
- Never prescribe treatment.
- possible_diseases must stay non-diagnostic and encourage seeing a doctor.
- If unreadable, still return best-effort JSON with type "lab", body_part "general", and note uncertainty in notes.`;
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
    outputLang: ApiLocale = 'en',
    options?: { includeInsight?: boolean },
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
      const genResult = await model.generateContent([
        { text: buildAnalysisPrompt(outputLang) },
        {
          inlineData: {
            mimeType: normalizedMime,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        },
      ]);

      const raw = genResult.response.text().trim();
      const jsonText = this.extractJsonObject(raw);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const analyzed = this.normalizeResult(parsed);
      if (options?.includeInsight === false) {
        return {
          ...analyzed,
          ai_insight: {
            description: '',
            possible_diseases: '',
          },
        };
      }
      return analyzed;
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
    outputLang?: ApiLocale;
  }): Promise<MedicalAiInsight> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    const outputLang = input.outputLang ?? 'en';
    const langLabel = outputLanguageLabel(outputLang);

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

  async draftRequestDescription(input: {
    title: string;
    type: string;
    patientContext: string;
    outputLang?: ApiLocale;
  }): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    const outputLang = input.outputLang ?? 'en';
    const langLabel = outputLanguageLabel(outputLang);
    const typeLabel = input.type === 'xray' ? 'X-ray / imaging' : 'lab test';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const prompt = `You help a doctor write a short clinical justification for a ${typeLabel} request inside a patient health app.

Request title: ${input.title}
Patient medical context (recent records/status, may be empty):
${input.patientContext?.trim() || 'None available'}

Write the request description in ${langLabel}, using AT MOST 5 short statements, explaining why this ${typeLabel} is being requested based on the title and the patient context above.

Return ONLY JSON (no markdown):
{ "description": "..." }

Rules:
- At most 5 short statements total (sentences or short clauses separated by newlines).
- Never give a definitive diagnosis.
- Keep the tone clear and reassuring for the patient.
- If the context is insufficient, base the description mainly on the title.`;

    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const jsonText = this.extractJsonObject(raw);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const description = String(parsed.description ?? '').trim();
      if (!description) {
        throw new BadRequestException('Could not generate a description');
      }
      return description;
    } catch (err) {
      this.logger.warn(
        `draftRequestDescription failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Could not draft a description for this request');
    }
  }

  async draftDiagnosisComplete(input: {
    diagnosisTitle: string;
    availableDocuments: { id: string; type: string; title: string; notes?: string }[];
    patientContext?: string;
    outputLang?: ApiLocale;
  }): Promise<{ symptoms: string[]; document_ids: string[]; body_part?: string }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    const outputLang = input.outputLang ?? 'en';
    const langLabel = outputLanguageLabel(outputLang);
    const bodyParts = MEDICAL_BODY_PARTS.join(', ');
    const docsList = input.availableDocuments.length
      ? input.availableDocuments
          .map(
            (d) =>
              `- id: ${d.id} | type: ${d.type} | title: ${d.title}${
                d.notes ? ` | notes: ${d.notes}` : ''
              }`,
          )
          .join('\n')
      : 'None';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const prompt = `You help a doctor complete a diagnosis for a patient.

Diagnosis title: ${input.diagnosisTitle}
Patient context (may be empty): ${input.patientContext?.trim() || 'None available'}

Available lab/X-ray documents for this patient:
${docsList}

Return ONLY valid JSON (no markdown) shaped like:
{
  "symptoms": ["short symptom statement in ${langLabel}", ...],
  "document_ids": ["<id copied exactly from the list above>", ...],
  "body_part": "one of: ${bodyParts}"
}

Rules:
- symptoms: at most 5 short, clinically relevant statements in ${langLabel} consistent with the diagnosis title and patient context.
- document_ids: ONLY include ids that literally appear in the available documents list above. If none are relevant, return an empty array. Never invent ids.
- body_part: pick the single most relevant one from the list; use "general" if unclear.
- Never provide treatment or medication instructions.`;

    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const jsonText = this.extractJsonObject(raw);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      const validIds = new Set(input.availableDocuments.map((d) => d.id));
      const rawIds = Array.isArray(parsed.document_ids) ? parsed.document_ids : [];
      const document_ids = rawIds
        .map((id) => String(id).trim())
        .filter((id) => validIds.has(id));

      const rawSymptoms = Array.isArray(parsed.symptoms) ? parsed.symptoms : [];
      const symptoms = rawSymptoms
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 5);

      const body_part = normalizeBodyPart(parsed.body_part) ?? undefined;

      return { symptoms, document_ids, body_part };
    } catch (err) {
      this.logger.warn(
        `draftDiagnosisComplete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Could not complete this diagnosis with AI');
    }
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
    let type: AnalyzedDocumentType = DocumentType.LAB;
    if (
      typeRaw === 'xray' ||
      typeRaw === 'imaging' ||
      typeRaw === 'scan'
    ) {
      type = DocumentType.XRAY;
    } else if (
      typeRaw === 'prescription' ||
      typeRaw === 'rx' ||
      typeRaw === 'medication'
    ) {
      type = DocumentType.PRESCRIPTION;
    }
    const title = String(parsed.title ?? '').trim() || 'Medical record';
    const notes = String(parsed.notes ?? parsed.description ?? '').trim() || title;
    const body_part =
      normalizeBodyPart(parsed.body_part ?? parsed.bodyPart) ?? 'general';
    const insight =
      normalizeMedicalAiInsight(parsed.ai_insight ?? parsed.insight) ?? {
        description: notes.slice(0, 200),
        possible_diseases:
          'Discuss these findings with your doctor for proper interpretation.',
      };

    return { type, title, notes, body_part, ai_insight: insight };
  }
}
