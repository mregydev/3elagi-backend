import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  countryDisplayName,
  countryMedicationCatalogForPrompt,
  matchCountryMedication,
  normalizePatientCountry,
} from '../common/country-medications';
import type { ApiLocale } from '../common/resolve-api-locale';
import { outputLanguageLabel } from '../common/resolve-api-locale';

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

  /**
   * Draft a prescription for doctor review. Medication names MUST resolve to the
   * catalog for the patient's residence country — unmatched names are dropped.
   */
  async draftCountryPrescription(input: {
    diagnosisTitle: string;
    patientContext: string;
    consultationContext?: string;
    symptoms?: string[];
    patientCountry?: string | null;
    outputLang?: ApiLocale;
  }): Promise<{
    title: string;
    symptoms: string;
    medications: ExtractedPrescriptionMedication[];
  }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }
    const outputLang = input.outputLang ?? 'en';
    const langLabel = outputLanguageLabel(outputLang);
    const countryCode = normalizePatientCountry(input.patientCountry);
    const countryName = countryDisplayName(
      countryCode,
      outputLang === 'ar' ? 'ar' : 'en',
    );
    const catalog = countryMedicationCatalogForPrompt(countryCode);
    const symptomsText = (input.symptoms ?? []).filter(Boolean).join('; ');

    const prompt = `You draft a SHORT outpatient prescription suggestion for a doctor treating a patient residing in ${countryName} (${countryCode}).

This is ONLY a draft for the doctor to revise — never a final prescription.

Diagnosis title: ${input.diagnosisTitle}
Symptoms: ${symptomsText || 'not provided'}
Patient residence country: ${countryName} (${countryCode})
Patient medical context:
${input.patientContext || 'none'}
Current / recent consultation context:
${input.consultationContext || 'none'}

ALLOWED medication names (${countryName} market ONLY — you MUST pick exclusively from this list):
${catalog}

Return ONLY valid JSON (no markdown) shaped like:
{
  "title": "short prescription title in ${langLabel}",
  "symptoms": "brief symptom summary in ${langLabel}",
  "medications": [
    {
      "medication_name": "EXACT name copied from the allowed list",
      "dose": "dose in ${langLabel}",
      "interval": "frequency in ${langLabel}",
      "notes": "optional short note in ${langLabel}"
    }
  ]
}

Rules:
- Suggest 1–5 medications maximum.
- medication_name MUST be copied EXACTLY from the allowed ${countryName} list. Never invent brands.
- Consider allergies and chronic conditions in patient context — avoid conflicting meds when possible.
- Prefer the most recent consultation context when deciding urgency/severity.
- Use cautious, standard outpatient choices only.
- Never invent lab values or diagnoses not in context.
- If unsure, return fewer medications rather than guessing.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });

    try {
      const result = await model.generateContent([{ text: prompt }]);
      const raw = result.response.text().trim();
      const jsonText = this.extractJsonObject(raw);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const rawMeds = Array.isArray(parsed.medications) ? parsed.medications : [];
      const medications = rawMeds
        .map((row) => this.normalizeRow(row))
        .map((row) => {
          const matched = matchCountryMedication(
            countryCode,
            row.medication_name,
          );
          if (!matched) return null;
          return { ...row, medication_name: matched };
        })
        .filter((row): row is ExtractedPrescriptionMedication => !!row)
        .slice(0, 5);

      if (!medications.length) {
        throw new BadRequestException(
          `AI could not draft medications listed for ${countryName}. Add medications manually.`,
        );
      }

      return {
        title:
          String(parsed.title ?? '').trim() ||
          input.diagnosisTitle.trim() ||
          'Prescription',
        symptoms: String(parsed.symptoms ?? symptomsText).trim(),
        medications,
      };
    } catch (err) {
      this.logger.warn(
        `Country prescription draft failed (${countryCode}): ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'Could not draft prescription with AI. Try again or add medications manually.',
      );
    }
  }

  /** @deprecated use draftCountryPrescription */
  async draftEgyptPrescription(input: {
    diagnosisTitle: string;
    patientContext: string;
    consultationContext?: string;
    symptoms?: string[];
    outputLang?: ApiLocale;
  }) {
    return this.draftCountryPrescription({
      ...input,
      patientCountry: 'EG',
    });
  }

  private extractJsonObject(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
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
