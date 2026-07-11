import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiLocale } from '../common/resolve-api-locale';
import { outputLanguageLabel, resolveApiLocale } from '../common/resolve-api-locale';

export interface ExtractedPrescriptionMedication {
  medication_name: string;
  dose?: string;
  interval?: string;
  notes?: string;
}

const DEFAULT_CHAT_MODEL = 'gemini-3-flash-preview';

function buildExtractionPrompt(outputLang: ApiLocale): string {
  const langLabel = outputLanguageLabel(outputLang);
  const doseExample =
    outputLang === 'ar'
      ? '500 مج، قرص واحد'
      : outputLang === 'de'
        ? '500 mg, 1 Tablette'
        : outputLang === 'es'
          ? '500 mg, 1 comprimido'
          : '500 mg, 1 tablet';
  const intervalExample =
    outputLang === 'ar'
      ? 'مرتين يوميًا، كل 8 ساعات'
      : outputLang === 'de'
        ? 'zweimal täglich, alle 8 Stunden'
        : outputLang === 'es'
          ? 'dos veces al día, cada 8 horas'
          : 'twice daily, every 8 hours';

  return `You analyze prescription or medication-list images for a medical app.

Extract every medication you can read from the image.

Return ONLY a valid JSON array (no markdown, no explanation) with objects shaped like:
[
  {
    "medication_name": "Drug name as written on the prescription",
    "dose": "amount/strength in ${langLabel}",
    "interval": "frequency/schedule in ${langLabel}",
    "notes": "extra instructions in ${langLabel} if any"
  }
]

Rules:
- Use empty string for fields that are not visible.
- Do not invent medications not shown in the image.
- Do not diagnose or give medical advice.
- medication_name: keep the drug name as shown on the prescription (do not translate).
- dose: ALWAYS write in ${langLabel}, even if the prescription is in another language. Translate/normalize (e.g. ${doseExample}).
- interval: ALWAYS write in ${langLabel}, even if the prescription is in another language. Translate/normalize (e.g. ${intervalExample}).
- notes: if present, write in ${langLabel} (translate from the prescription if needed).
- Never copy dose or interval text verbatim from the prescription if that language is not ${langLabel}.`;
}

@Injectable()
export class PrescriptionImageAnalyzerService {
  private readonly logger = new Logger(PrescriptionImageAnalyzerService.name);
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.modelName =
      this.config.get<string>('GEMINI_CHAT_MODEL') ?? DEFAULT_CHAT_MODEL;
  }

  async extractMedications(
    imageBase64: string,
    mimeType: string,
    outputLang: ApiLocale = 'en',
  ): Promise<ExtractedPrescriptionMedication[]> {
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
        { text: buildExtractionPrompt(outputLang) },
        {
          inlineData: {
            mimeType: normalizedMime,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        },
      ]);

      const raw = result.response.text().trim();
      const jsonText = this.extractJsonArray(raw);
      const parsed = JSON.parse(jsonText) as unknown;

      if (!Array.isArray(parsed)) {
        throw new BadRequestException('Could not parse medications from image');
      }

      return parsed
        .map((row) => this.normalizeRow(row))
        .filter((row) => row.medication_name.trim().length > 0);
    } catch (err) {
      this.logger.warn(
        `Prescription image extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'Could not extract medications from this image. Try a clearer photo or add them manually.',
      );
    }
  }

  private extractJsonArray(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) return text.slice(start, end + 1);
    return text;
  }

  private normalizeRow(row: unknown): ExtractedPrescriptionMedication {
    const source =
      row && typeof row === 'object'
        ? (row as Record<string, unknown>)
        : {};
    const medication_name = String(
      source.medication_name ?? source.name ?? source.medication ?? '',
    ).trim();
    return {
      medication_name,
      dose: String(source.dose ?? '').trim() || undefined,
      interval:
        String(source.interval ?? source.frequency ?? source.freq ?? '').trim() ||
        undefined,
      notes: String(source.notes ?? source.note ?? '').trim() || undefined,
    };
  }
}
