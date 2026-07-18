import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { DoctorPatientAccess } from '../../../entities/doctor-patient-access.entity';
import { Doctor } from '../../../entities/doctor.entity';
import { DoctorReview } from '../../../entities/review.entity';
import { UserRole } from '../../../entities/user.entity';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface DoctorPracticeInsightsPayload {
  patientCount: number;
  recordsAccessCount: number;
  totalDiagnoses: number;
  diagnosesLast30Days: number;
  diagnosesLast90Days: number;
  avgRating: number;
  reviewCount: number;
  recentReviews: Array<{ rating: number; comment: string | null }>;
  commonDiagnosisTerms: string[];
  platformAvgRating: number;
  platformAvgPatients: number;
  platformReviewThemes: string[];
}

@Injectable()
export class DoctorPracticeInsightsContextSource implements AIContextSource {
  readonly name = 'doctor_practice_insights';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(DoctorReview)
    private readonly reviewRepo: Repository<DoctorReview>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'doctor_coaching_question' ||
      intent === 'doctor_profile_question' ||
      intent === 'doctor_practice_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<DoctorPracticeInsightsPayload | null> {
    if (user.role !== UserRole.DOCTOR) return null;

    const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    if (!doctor) return null;

    const now = Date.now();
    const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const day90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const [accessRows, diagnoses, reviews, platformStats] = await Promise.all([
      this.accessRepo.find({
        where: {
          doctor_id: doctor.id,
          blocked_by_patient: false,
          blocked_by_doctor: false,
        },
      }),
      this.diagnosisRepo.find({
        where: { doctor_id: doctor.id },
        order: { created_at: 'DESC' },
        take: 100,
      }),
      this.reviewRepo.find({
        where: { doctor_id: doctor.id },
        order: { created_at: 'DESC' },
        take: 15,
      }),
      this.fetchPlatformBenchmarks(doctor.id),
    ]);

    const recordsAccessCount = accessRows.filter((r) => r.records_allowed).length;
    const diagnosesLast30Days = diagnoses.filter(
      (d) => d.created_at >= day30,
    ).length;
    const diagnosesLast90Days = diagnoses.filter(
      (d) => d.created_at >= day90,
    ).length;

    const termCounts = new Map<string, number>();
    for (const d of diagnoses) {
      for (const word of d.desc.toLowerCase().split(/\s+/)) {
        if (word.length < 4) continue;
        termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
      }
    }
    const commonDiagnosisTerms = [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);

    const avgRating =
      reviews.length > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10,
          ) / 10
        : 0;

    return {
      patientCount: accessRows.length,
      recordsAccessCount,
      totalDiagnoses: diagnoses.length,
      diagnosesLast30Days,
      diagnosesLast90Days,
      avgRating,
      reviewCount: reviews.length,
      recentReviews: reviews.slice(0, 8).map((r) => ({
        rating: r.rating,
        comment: r.comment,
      })),
      commonDiagnosisTerms,
      ...platformStats,
    };
  }

  private async fetchPlatformBenchmarks(excludeDoctorId: string): Promise<{
    platformAvgRating: number;
    platformAvgPatients: number;
    platformReviewThemes: string[];
  }> {
    const [ratingRow, doctorCount, accessCount, peerReviews] = await Promise.all([
      this.reviewRepo
        .createQueryBuilder('r')
        .select('AVG(r.rating)', 'avg')
        .getRawOne<{ avg: string }>(),
      this.doctorRepo.count({ where: { approval_status: 'approved' } }),
      this.accessRepo.count(),
      this.reviewRepo.find({
        where: {},
        order: { created_at: 'DESC' },
        take: 40,
      }),
    ]);

    const filteredPeerReviews = peerReviews.filter(
      (r) => r.doctor_id !== excludeDoctorId && r.comment?.trim(),
    );

    const themeCounts = new Map<string, number>();
    for (const review of filteredPeerReviews) {
      const comment = review.comment!.toLowerCase();
      const themes = [
        { pattern: /\b(wait|waiting|late|delay)\b/, label: 'wait times' },
        { pattern: /\b(kind|caring|empathy|listen)\b/, label: 'empathy and listening' },
        { pattern: /\b(explain|clear|understand)\b/, label: 'clear explanations' },
        { pattern: /\b(professional|expert|skilled)\b/, label: 'professionalism' },
        { pattern: /\b(rude|unhelpful|bad|poor)\b/, label: 'negative experience' },
        { pattern: /\b(recommend|excellent|great|best)\b/, label: 'strong recommendation' },
        { pattern: /\b(follow.?up|followup|aftercare)\b/, label: 'follow-up care' },
        { pattern: /\b(communication|responsive|reply)\b/, label: 'communication' },
      ];
      for (const { pattern, label } of themes) {
        if (pattern.test(comment)) {
          themeCounts.set(label, (themeCounts.get(label) ?? 0) + 1);
        }
      }
    }

    const platformReviewThemes = [...themeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => `${label} (${count} mentions)`);

    return {
      platformAvgRating: Math.round(Number(ratingRow?.avg ?? 0) * 10) / 10,
      platformAvgPatients:
        doctorCount > 0 ? Math.round((accessCount / doctorCount) * 10) / 10 : 0,
      platformReviewThemes,
    };
  }

  buildContextText(data: unknown): string {
    const payload = data as DoctorPracticeInsightsPayload | null;
    if (!payload) return '';

    const lines = [
      '[Practice insights — use for coaching, performance feedback, and improvement suggestions]',
      `Patients connected: ${payload.patientCount} (${payload.recordsAccessCount} granted medical records access)`,
      `Diagnoses you recorded: ${payload.totalDiagnoses} total, ${payload.diagnosesLast30Days} in last 30 days, ${payload.diagnosesLast90Days} in last 90 days`,
      `Your average rating: ${payload.avgRating || 'No ratings yet'} (${payload.reviewCount} reviews)`,
      `Platform average rating: ${payload.platformAvgRating || 'N/A'}`,
      `Platform average patients per doctor: ${payload.platformAvgPatients || 'N/A'}`,
    ];

    if (payload.commonDiagnosisTerms.length) {
      lines.push(
        `Common conditions you diagnose: ${payload.commonDiagnosisTerms.join(', ')}`,
      );
    }

    if (payload.recentReviews.length) {
      lines.push('\nRecent patient feedback on you:');
      for (const r of payload.recentReviews) {
        lines.push(
          `- ${r.rating}/5${r.comment ? `: ${r.comment.slice(0, 250)}` : ''}`,
        );
      }
    } else {
      lines.push('\nNo patient reviews yet.');
    }

    if (payload.platformReviewThemes.length) {
      lines.push(
        `\nCommon feedback themes from other doctors on the platform: ${payload.platformReviewThemes.join('; ')}`,
      );
    }

    lines.push(
      '\nUse this data to advise on workload, patient engagement frequency, strengths, areas to improve, and how the doctor compares to peers — always encourage clinical judgment. Medication suggestions are reference only; the doctor must confirm and decide treatment.',
    );

    return lines.join('\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.DOCTOR) return 'doctor_insights:skip';
    const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    if (!doctor) return 'doctor_insights:none';

    const [patientCount, diagCount, reviewCount] = await Promise.all([
      this.accessRepo.count({ where: { doctor_id: doctor.id } }),
      this.diagnosisRepo.count({ where: { doctor_id: doctor.id } }),
      this.reviewRepo.count({ where: { doctor_id: doctor.id } }),
    ]);
    return `doctor_insights:${doctor.id}:${patientCount}:${diagCount}:${reviewCount}`;
  }
}
