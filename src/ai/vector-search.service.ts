import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { Doctor } from '../entities/doctor.entity';
import { UserRole } from '../entities/user.entity';
import { EmbeddingsService } from './embeddings.service';
import type { RetrievedChunk } from './ai-prompt.service';
import { PLATFORM_KNOWLEDGE_SCOPE } from './types/knowledge-entity-type';

export interface VectorSearchOptions {
  userId: string;
  userRole: string;
  patientUserId?: string;
  limit?: number;
}

export interface VectorSearchResult {
  chunks: RetrievedChunk[];
  embedding: number[];
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsService,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
  ) {}

  async search(
    question: string,
    options: VectorSearchOptions,
  ): Promise<VectorSearchResult> {
    const allowedPatientIds = await this.resolveAllowedPatientIds(options);
    const limit = options.limit ?? 10;

    try {
      const embedding = await this.embeddings.embedQuery(question);
      const vectorLiteral = `[${embedding.join(',')}]`;
      const rows = await this.dataSource.query(
        `
        SELECT entity_type, entity_id, text, metadata,
               1 - (embedding <=> $1::vector) AS score
        FROM ai_knowledge_chunks
        WHERE embedding IS NOT NULL
          AND (
            (cardinality($2::uuid[]) > 0 AND patient_id = ANY($2::uuid[]))
            OR metadata->>'scope' = 'platform'
          )
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [vectorLiteral, allowedPatientIds, limit],
      );

      const chunks: RetrievedChunk[] = rows.map(
        (row: {
          entity_type: string;
          entity_id: string;
          text: string;
          metadata: Record<string, unknown>;
        }) => ({
          entityType: row.entity_type,
          entityId: row.entity_id,
          text: row.text,
          metadata: row.metadata ?? {},
        }),
      );

      if (!chunks.length) {
        const fallback = await this.fetchPlatformChunks(limit);
        if (fallback.length) {
          this.logger.log(
            `Vector search returned no chunks; using ${fallback.length} platform fallback chunk(s)`,
          );
          return { chunks: fallback, embedding };
        }
      }

      return { chunks, embedding };
    } catch (err) {
      this.logger.warn(
        `Vector search unavailable, trying platform fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const fallback = await this.fetchPlatformChunks(limit);
      return { chunks: fallback, embedding: [] };
    }
  }

  private async fetchPlatformChunks(limit: number): Promise<RetrievedChunk[]> {
    const rows = await this.dataSource.query(
      `
      SELECT entity_type, text, metadata
      FROM ai_knowledge_chunks
      WHERE metadata->>'scope' = $1
      ORDER BY
        CASE entity_type
          WHEN 'doctor_directory' THEN 0
          WHEN 'speciality_catalog' THEN 1
          ELSE 2
        END,
        updated_at DESC
      LIMIT $2
      `,
      [PLATFORM_KNOWLEDGE_SCOPE, limit],
    );

    return rows.map(
      (row: {
        entity_type: string;
        text: string;
        metadata: Record<string, unknown>;
      }) => ({
        entityType: row.entity_type,
        text: row.text,
        metadata: row.metadata ?? {},
      }),
    );
  }

  private async resolveAllowedPatientIds(
    options: VectorSearchOptions,
  ): Promise<string[]> {
    const { userId, userRole, patientUserId } = options;

    if (userRole === UserRole.PATIENT) {
      if (patientUserId && patientUserId !== userId) {
        throw new ForbiddenException('Patients can only access their own records');
      }
      return [userId];
    }

    if (userRole === UserRole.DOCTOR) {
      const doctor = await this.doctorRepo.findOne({
        where: { user_id: userId },
      });
      if (!doctor) throw new ForbiddenException('Doctor profile not found');

      if (patientUserId) {
        await this.assertDoctorAccess(doctor.id, patientUserId);
        return [patientUserId];
      }

      const rows = await this.accessRepo.find({
        where: {
          doctor_id: doctor.id,
          records_allowed: true,
          blocked_by_patient: false,
          blocked_by_doctor: false,
        },
      });
      return rows.map((r) => r.patient_user_id);
    }

    if (userRole === UserRole.ADMIN || userRole === UserRole.CLINIC_ADMIN) {
      if (patientUserId) return [patientUserId];
      return [];
    }

    throw new ForbiddenException('Role not permitted for AI assistant');
  }

  private async assertDoctorAccess(
    doctorId: string,
    patientUserId: string,
  ): Promise<void> {
    const row = await this.accessRepo.findOne({
      where: { doctor_id: doctorId, patient_user_id: patientUserId },
    });
    if (
      !row ||
      !row.records_allowed ||
      row.blocked_by_patient ||
      row.blocked_by_doctor
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this patient\'s records',
      );
    }
  }
}
