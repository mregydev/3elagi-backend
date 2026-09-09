import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  doctorTagI18nFor,
  localizeDoctorTagLabel,
  normalizeDoctorTagLocale,
  type DoctorTagLocale,
} from '../constants/doctor-tag-i18n';
import {
  COMMON_DOCTOR_TAG_SEEDS,
  normalizeDoctorTagKey,
  normalizeDoctorTagLabel,
} from '../constants/doctor-tag-seeds';
import {
  normalizeSubspecialtyKey,
  normalizeSubspecialtyName,
} from '../constants/subspecialty-seeds';
import { DoctorTagCatalog } from '../entities/doctor-tag-catalog.entity';
import { Subspecialty } from '../entities/subspecialty.entity';

export type DoctorTagSuggestion = {
  id: string;
  label: string;
  label_en: string;
  speciality_id: string | null;
  source: 'subspecialty' | 'common';
};

export type ResolvedDoctorTagLabel = {
  canonical: string;
  display: string;
};

@Injectable()
export class DoctorTagsService {
  constructor(
    @InjectRepository(DoctorTagCatalog)
    private readonly catalogRepo: Repository<DoctorTagCatalog>,
    @InjectRepository(Subspecialty)
    private readonly subspecialtyRepo: Repository<Subspecialty>,
  ) {}

  private pickCatalogLabel(
    row: DoctorTagCatalog,
    locale: DoctorTagLocale,
  ): string {
    if (locale === 'ar' && row.label_ar) return row.label_ar;
    if (locale === 'de' && row.label_de) return row.label_de;
    if (locale === 'es' && row.label_es) return row.label_es;
    return row.label;
  }

  private pickSubspecialtyLabel(
    row: Subspecialty,
    locale: DoctorTagLocale,
  ): string {
    if (locale === 'ar' && row.name_ar) return row.name_ar;
    if (locale === 'de' && row.name_de) return row.name_de;
    if (locale === 'es' && row.name_es) return row.name_es;
    return row.name_en;
  }

  private localizeLabel(
    canonical: string,
    catalogRow: DoctorTagCatalog | undefined,
    subspecialtyRow: Subspecialty | undefined,
    locale: DoctorTagLocale,
  ): string {
    if (subspecialtyRow) return this.pickSubspecialtyLabel(subspecialtyRow, locale);
    if (catalogRow) return this.pickCatalogLabel(catalogRow, locale);
    return localizeDoctorTagLabel(canonical, locale);
  }

  async listSuggestions(options: {
    specialityIds?: string[];
    q?: string;
    limit?: number;
    locale?: string;
  }): Promise<DoctorTagSuggestion[]> {
    const locale = normalizeDoctorTagLocale(options.locale);
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 30);
    const q = (options.q ?? '').trim().toLowerCase();
    const primarySpecialityId =
      (options.specialityIds ?? []).filter(Boolean)[0] ?? null;

    const results: DoctorTagSuggestion[] = [];
    const seen = new Set<string>();

    const pushResult = (item: DoctorTagSuggestion) => {
      const key = normalizeDoctorTagKey(item.label_en);
      if (!key || seen.has(key)) return;
      seen.add(key);
      results.push(item);
    };

    if (primarySpecialityId) {
      const subspecialtyQb = this.subspecialtyRepo
        .createQueryBuilder('sub')
        .where('sub.speciality_id = :specialityId', {
          specialityId: primarySpecialityId,
        });
      if (q) {
        subspecialtyQb.andWhere(
          '(sub.name_normalized LIKE :q OR LOWER(sub.name_en) LIKE :q OR sub.name_ar LIKE :q OR sub.name_de LIKE :q OR sub.name_es LIKE :q)',
          { q: `%${q}%` },
        );
      }
      const subspecialties = await subspecialtyQb
        .orderBy('sub.name_en', 'ASC')
        .getMany();
      for (const row of subspecialties) {
        pushResult({
          id: row.id,
          label: this.pickSubspecialtyLabel(row, locale),
          label_en: row.name_en,
          speciality_id: row.speciality_id,
          source: 'subspecialty',
        });
        if (results.length >= limit) return results;
      }
    }

    const catalogQb = this.catalogRepo
      .createQueryBuilder('tag')
      .where('tag.speciality_id IS NULL');
    if (q) {
      catalogQb.andWhere(
        '(tag.label_normalized LIKE :q OR LOWER(tag.label) LIKE :q OR tag.label_ar LIKE :q OR tag.label_de LIKE :q OR tag.label_es LIKE :q)',
        { q: `%${q}%` },
      );
    }
    const catalogRows = await catalogQb.orderBy('tag.label', 'ASC').getMany();
    for (const row of catalogRows) {
      pushResult({
        id: row.id,
        label: this.pickCatalogLabel(row, locale),
        label_en: row.label,
        speciality_id: null,
        source: 'common',
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  async resolveLabels(
    labels: string[],
    localeRaw?: string,
  ): Promise<ResolvedDoctorTagLabel[]> {
    const locale = normalizeDoctorTagLocale(localeRaw);
    const canonicals = labels
      .map((label) => normalizeDoctorTagLabel(label))
      .filter(Boolean);
    if (!canonicals.length) return [];

    const keys = canonicals.map((label) => normalizeDoctorTagKey(label));
    const [catalogRows, subspecialtyRows] = await Promise.all([
      this.catalogRepo.find({ where: { label_normalized: In(keys) } }),
      this.subspecialtyRepo.find({ where: { name_normalized: In(keys) } }),
    ]);
    const catalogByKey = new Map(
      catalogRows.map((row) => [row.label_normalized, row]),
    );
    const subspecialtyByKey = new Map(
      subspecialtyRows.map((row) => [row.name_normalized, row]),
    );

    return canonicals.map((canonical) => {
      const key = normalizeDoctorTagKey(canonical);
      return {
        canonical,
        display: this.localizeLabel(
          canonical,
          catalogByKey.get(key),
          subspecialtyByKey.get(key),
          locale,
        ),
      };
    });
  }

  /** Persist doctor-chosen tags into catalog / subspecialties for future autocomplete. */
  async registerDoctorTags(
    tags: string[],
    primarySpecialityId?: string | null,
  ): Promise<void> {
    const specId = primarySpecialityId?.trim() || null;
    const commonKeys = new Set(
      COMMON_DOCTOR_TAG_SEEDS.map((seed) => normalizeDoctorTagKey(seed)),
    );

    for (const raw of tags) {
      const label = normalizeDoctorTagLabel(raw);
      const labelNormalized = normalizeDoctorTagKey(label);
      if (!labelNormalized) continue;

      const existingSubspecialty = await this.subspecialtyRepo.findOne({
        where: { name_normalized: labelNormalized },
      });
      if (existingSubspecialty) continue;

      const existingCatalog = await this.catalogRepo.findOne({
        where: { label_normalized: labelNormalized },
      });
      if (existingCatalog) continue;

      const i18n = doctorTagI18nFor(label);
      const asSubspecialty = specId && !commonKeys.has(labelNormalized);

      if (asSubspecialty) {
        await this.subspecialtyRepo.save(
          this.subspecialtyRepo.create({
            name_en: normalizeSubspecialtyName(label),
            name_normalized: normalizeSubspecialtyKey(label),
            name_ar: i18n?.ar ?? null,
            name_de: i18n?.de ?? null,
            name_es: i18n?.es ?? null,
            speciality_id: specId,
            is_seeded: false,
          }),
        );
        continue;
      }

      await this.catalogRepo.save(
        this.catalogRepo.create({
          label,
          label_normalized: labelNormalized,
          label_ar: i18n?.ar ?? null,
          label_de: i18n?.de ?? null,
          label_es: i18n?.es ?? null,
          speciality_id: null,
          is_seeded: false,
        }),
      );
    }
  }

  normalizeTags(tags: unknown): string[] {
    const list = Array.isArray(tags) ? tags : [];
    const seen = new Set<string>();
    return list
      .map((t) => (typeof t === 'string' ? normalizeDoctorTagLabel(t) : ''))
      .filter((t) => {
        if (!t) return false;
        const key = normalizeDoctorTagKey(t);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }
}
