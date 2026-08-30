import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppReview } from '../entities/app-review.entity';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';

export const APP_REVIEW_IMPROVEMENT_TAGS = [
  'ease_of_use',
  'performance',
  'design',
  'video',
  'chat',
  'support',
  'features',
  'mobile',
  'arabic',
] as const;

export type AppReviewImprovementTag =
  (typeof APP_REVIEW_IMPROVEMENT_TAGS)[number];

@Injectable()
export class AppReviewsService {
  constructor(
    @InjectRepository(AppReview)
    private readonly reviewRepo: Repository<AppReview>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
  ) {}

  async findMine(userId: string) {
    const row = await this.reviewRepo.findOne({ where: { user_id: userId } });
    return row ? this.mapRow(row) : null;
  }

  async submit(
    user: {
      id: string;
      email?: string;
      role?: string;
      name?: string;
    },
    input: {
      rating: number;
      comment?: string;
      improvementTags?: string[];
    },
  ) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5 stars');
    }

    const comment = (input.comment ?? '').trim().slice(0, 2000) || null;
    const tags = this.normalizeTags(input.improvementTags ?? []);

    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    const [doctor, patient] = await Promise.all([
      this.doctorRepo.findOne({ where: { user_id: user.id } }),
      this.patientRepo.findOne({ where: { user_id: user.id } }),
    ]);
    const displayName =
      patient?.name?.trim() ||
      doctor?.name?.trim() ||
      dbUser?.email?.split('@')[0] ||
      user.email?.split('@')[0] ||
      '3elagi user';

    const existing = await this.reviewRepo.findOne({
      where: { user_id: user.id },
    });

    const payload = {
      user_id: user.id,
      user_name: displayName,
      user_email: user.email?.trim().toLowerCase() || dbUser?.email || null,
      user_role: user.role?.trim() || null,
      rating,
      comment,
      improvement_tags: tags,
      read_at: null,
    };

    const saved = existing
      ? await this.reviewRepo.save({ ...existing, ...payload })
      : await this.reviewRepo.save(this.reviewRepo.create(payload));

    return this.mapRow(saved);
  }

  async listForAdmin() {
    const rows = await this.reviewRepo.find({
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.mapRow(row, { includeComment: false }));
  }

  async findOneForAdmin(id: string) {
    const row = await this.reviewRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('App review not found');
    if (!row.read_at) {
      row.read_at = new Date();
      await this.reviewRepo.save(row);
    }
    return this.mapRow(row, { includeComment: true });
  }

  async markRead(id: string, read: boolean) {
    const row = await this.reviewRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('App review not found');
    row.read_at = read ? row.read_at ?? new Date() : null;
    await this.reviewRepo.save(row);
    return this.mapRow(row, { includeComment: true });
  }

  private normalizeTags(tags: string[]): AppReviewImprovementTag[] {
    const allowed = new Set<string>(APP_REVIEW_IMPROVEMENT_TAGS);
    const out: AppReviewImprovementTag[] = [];
    for (const raw of tags) {
      const key = (raw ?? '').trim().toLowerCase();
      if (!allowed.has(key)) continue;
      if (!out.includes(key as AppReviewImprovementTag)) {
        out.push(key as AppReviewImprovementTag);
      }
    }
    return out;
  }

  private mapRow(
    row: AppReview,
    opts: { includeComment?: boolean } = { includeComment: true },
  ) {
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      user_role: row.user_role,
      rating: row.rating,
      comment: opts.includeComment ? row.comment : undefined,
      comment_preview: row.comment?.slice(0, 160) ?? '',
      improvement_tags: row.improvement_tags ?? [],
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
