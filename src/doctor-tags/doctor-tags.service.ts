import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizeDoctorTagKey,
  normalizeDoctorTagLabel,
} from '../constants/doctor-tag-seeds';
import { DoctorTagCatalog } from '../entities/doctor-tag-catalog.entity';

export type DoctorTagSuggestion = {
  id: string;
  label: string;
  speciality_id: string | null;
  source: 'speciality' | 'common';
};

@Injectable()
export class DoctorTagsService {
  constructor(
    @InjectRepository(DoctorTagCatalog)
    private readonly catalogRepo: Repository<DoctorTagCatalog>,
  ) {}

  async listSuggestions(options: {
    specialityIds?: string[];
    q?: string;
    limit?: number;
  }): Promise<DoctorTagSuggestion[]> {
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 30);
    const q = (options.q ?? '').trim().toLowerCase();
    const specialityIds = [...new Set((options.specialityIds ?? []).filter(Boolean))];
    const specialitySet = new Set(specialityIds);

    const qb = this.catalogRepo.createQueryBuilder('tag');
    if (q) {
      qb.andWhere('tag.label_normalized LIKE :q', { q: `%${q}%` });
    }

    if (specialityIds.length) {
      qb.andWhere(
        '(tag.speciality_id IN (:...specialityIds) OR tag.speciality_id IS NULL)',
        { specialityIds },
      );
    } else {
      qb.andWhere('tag.speciality_id IS NULL');
    }

    const rows = await qb.getMany();
    rows.sort((a, b) => {
      const aRank =
        a.speciality_id && specialitySet.has(a.speciality_id) ? 0 : 1;
      const bRank =
        b.speciality_id && specialitySet.has(b.speciality_id) ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.label.localeCompare(b.label);
    });

    const results: DoctorTagSuggestion[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.label_normalized)) continue;
      seen.add(row.label_normalized);
      results.push({
        id: row.id,
        label: row.label,
        speciality_id: row.speciality_id,
        source:
          row.speciality_id && specialitySet.has(row.speciality_id)
            ? 'speciality'
            : 'common',
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  /** Persist doctor-chosen tags into the shared catalog for future autocomplete. */
  async registerDoctorTags(
    tags: string[],
    primarySpecialityId?: string | null,
  ): Promise<void> {
    const specId = primarySpecialityId?.trim() || null;
    for (const raw of tags) {
      const label = normalizeDoctorTagLabel(raw);
      const labelNormalized = normalizeDoctorTagKey(label);
      if (!labelNormalized) continue;

      const existing = await this.catalogRepo.findOne({
        where: { label_normalized: labelNormalized },
      });
      if (existing) continue;

      await this.catalogRepo.save(
        this.catalogRepo.create({
          label,
          label_normalized: labelNormalized,
          speciality_id: specId,
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
