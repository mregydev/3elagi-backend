import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../../../entities/doctor.entity';
import { DoctorReview } from '../../../entities/review.entity';
import { UserRole } from '../../../entities/user.entity';
import { buildDoctorProfileText } from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface DoctorRow {
  doctor: Doctor;
  avgRating: number;
  reviewCount: number;
  sampleReviews: DoctorReview[];
}

@Injectable()
export class DoctorsContextSource implements AIContextSource {
  readonly name = 'doctors';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorReview)
    private readonly reviewRepo: Repository<DoctorReview>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'doctor_recommendation_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser, question: string): Promise<DoctorRow[]> {
    if (user.role === UserRole.DOCTOR) return [];
    const doctors = await this.doctorRepo.find({
      where: { approval_status: 'approved' },
      relations: ['speciality'],
      order: { name: 'ASC' },
    });

    const q = question.toLowerCase();
    const filtered = doctors.filter((d) => {
      const spec =
        d.speciality?.name_en?.toLowerCase() ??
        d.professional_title?.toLowerCase() ??
        '';
      if (!q.includes('doctor') && !q.includes('recommend') && spec) {
        return q.split(/\s+/).some((word) => word.length > 3 && spec.includes(word));
      }
      return true;
    });

    const list = (filtered.length ? filtered : doctors).slice(0, 25);

    return Promise.all(
      list.map(async (doctor) => {
        const stats = await this.reviewRepo
          .createQueryBuilder('r')
          .select('AVG(r.rating)', 'avg')
          .addSelect('COUNT(*)', 'total')
          .where('r.doctor_id = :doctorId', { doctorId: doctor.id })
          .getRawOne<{ avg: string; total: string }>();

        const reviews = await this.reviewRepo.find({
          where: { doctor_id: doctor.id },
          order: { created_at: 'DESC' },
          take: 3,
        });

        return {
          doctor,
          avgRating: Math.round(Number(stats?.avg ?? 0) * 10) / 10,
          reviewCount: Number(stats?.total ?? 0),
          sampleReviews: reviews,
        };
      }),
    );
  }

  buildContextText(data: unknown): string {
    const rows = data as DoctorRow[];
    if (!rows?.length) {
      return '[Doctors]\nNo approved doctors found in the platform database.';
    }

    const lines = [
      '[Doctors — use ONLY these doctors for recommendations. Never invent doctors, ratings, or reviews.]',
    ];

    for (const row of rows) {
      lines.push(
        buildDoctorProfileText(row.doctor, row.doctor.speciality ?? null),
      );
      lines.push(`Link: /doctor/${row.doctor.id} | Dr ${row.doctor.name}`);
      lines.push(
        `Booking: doctorEntityId=${row.doctor.id} doctorUserId=${row.doctor.user_id} price=${row.doctor.video_consultation_price ?? 1} durationMinutes=${row.doctor.video_consultation_minutes ?? 30}`,
      );
      lines.push(
        `Average rating: ${row.avgRating || 'No ratings yet'} (${row.reviewCount} reviews)`,
      );
      lines.push(`Consultation price: ${row.doctor.consultation_price ?? 1} EGP credits per consultation`);
      if (row.sampleReviews.length) {
        lines.push('Recent reviews:');
        for (const r of row.sampleReviews) {
          lines.push(
            `- ${r.rating}/5${r.comment ? `: ${r.comment.slice(0, 200)}` : ''}`,
          );
        }
      }
      lines.push('---');
    }

    return lines.join('\n');
  }

  async getVersionKey(_user: AiContextUser): Promise<string> {
    const count = await this.doctorRepo.count({
      where: { approval_status: 'approved' },
    });
    const reviewCount = await this.reviewRepo.count();
    return `doctors:${count}:${reviewCount}`;
  }
}
