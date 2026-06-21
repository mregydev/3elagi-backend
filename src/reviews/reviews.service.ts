import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorReview } from '../entities/review.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Diagnosis } from '../entities/diagnosis.entity';

export interface ReviewsPage {
  data: {
    id: string;
    rating: number;
    comment: string | null;
    patientName: string;
    createdAt: Date;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ReviewDto {
  rating: number;
  comment?: string | null;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(DoctorReview)
    private reviewRepo: Repository<DoctorReview>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private profileRepo: Repository<PatientProfile>,
    @InjectRepository(Diagnosis)
    private diagnosisRepo: Repository<Diagnosis>,
  ) {}

  private async hasDiagnosisFromDoctor(
    patientUserId: string,
    doctorId: string,
  ): Promise<boolean> {
    const count = await this.diagnosisRepo.count({
      where: { patient_id: patientUserId, doctor_id: doctorId },
    });
    return count > 0;
  }

  async patientReviewStatus(doctorId: string, userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }

    const canReview = await this.hasDiagnosisFromDoctor(userId, doctorId);
    const existing = await this.reviewRepo.findOne({
      where: { doctor_id: doctorId, patient_user_id: userId },
    });

    return {
      can_review: canReview,
      has_existing_review: !!existing,
      existing_review: existing
        ? {
            rating: existing.rating,
            comment: existing.comment,
          }
        : null,
    };
  }

  async listForDoctorUser(userId: string, page: number, limit: number): Promise<ReviewsPage> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;

    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { doctor_id: doctor.id },
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    return {
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        patientName: r.patient_name,
        createdAt: r.created_at,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async list(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }
    const stats = await this.reviewRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(AVG(r.rating), 0)', 'avg')
      .where('r.doctor_id = :doctorId', { doctorId })
      .getRawOne<{ total: string; avg: string }>();
    const total = Number(stats?.total ?? 0);
    const avg = Number(stats?.avg ?? 0);
    const reviews = await this.reviewRepo.find({
      where: { doctor_id: doctorId },
      order: { created_at: 'DESC' },
      take: 50,
    });
    return {
      total,
      average: Math.round(avg * 10) / 10,
      items: reviews.map((r) => ({
        id: r.id,
        patient_name: r.patient_name,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
      })),
    };
  }

  async create(doctorId: string, userId: string, dto: ReviewDto) {
    const rating = Number(dto?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be an integer between 1 and 5');
    }
    const comment =
      typeof dto?.comment === 'string' ? dto.comment.trim().slice(0, 1000) : null;

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }

    const canReview = await this.hasDiagnosisFromDoctor(userId, doctorId);
    if (!canReview) {
      throw new ForbiddenException(
        'You can only review a doctor after they have added a diagnosis for you',
      );
    }

    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    const patientName = profile?.name || 'Patient';

    const existing = await this.reviewRepo.findOne({
      where: { doctor_id: doctorId, patient_user_id: userId },
    });
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.patient_name = patientName;
      await this.reviewRepo.save(existing);
      return existing;
    }
    const created = this.reviewRepo.create({
      doctor_id: doctorId,
      patient_user_id: userId,
      patient_name: patientName,
      rating,
      comment,
    });
    try {
      return await this.reviewRepo.save(created);
    } catch (err: unknown) {
      // Race: another concurrent insert may have won the unique index.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === '23505'
      ) {
        const existingNow = await this.reviewRepo.findOne({
          where: { doctor_id: doctorId, patient_user_id: userId },
        });
        if (existingNow) {
          existingNow.rating = rating;
          existingNow.comment = comment;
          existingNow.patient_name = patientName;
          return this.reviewRepo.save(existingNow);
        }
      }
      throw err;
    }
  }
}
