import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import {
  DeletedAccount,
  type DeletedAccountSource,
  type DeletedAccountType,
} from '../entities/deleted-account.entity';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(DeletedAccount)
    private readonly deletedAccountRepo: Repository<DeletedAccount>,
  ) {}

  listDeletedAccounts() {
    return this.deletedAccountRepo.find({
      order: { deleted_at: 'DESC' },
      take: 500,
    });
  }

  /** Self-service: patient or doctor deletes their own account (password required). */
  async deleteOwnAccount(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PATIENT && user.role !== UserRole.DOCTOR) {
      throw new BadRequestException('This account cannot be deleted here');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new BadRequestException('Incorrect password');
    }
    await this.deleteUserAccount(userId, 'self');
  }

  /** Admin or internal: delete a patient by user id. */
  async deletePatientAccount(userId: string, deletedBy: DeletedAccountSource = 'admin') {
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) throw new NotFoundException('Patient not found');
    if (profile.is_specialty_test_account) {
      throw new BadRequestException('Specialty test accounts cannot be deleted');
    }
    await this.deleteUserAccount(userId, deletedBy);
  }

  /** Admin or internal: delete a doctor by doctor entity id. */
  async deleteDoctorAccount(
    doctorId: string,
    deletedBy: DeletedAccountSource = 'admin',
  ) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor?.user_id) throw new NotFoundException('Doctor not found');
    await this.deleteUserAccount(doctor.user_id, deletedBy);
  }

  private async deleteUserAccount(
    userId: string,
    deletedBy: DeletedAccountSource,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be deleted');
    }

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: userId },
      relations: ['speciality'],
    });
    const patient = await this.patientProfileRepo.findOne({
      where: { user_id: userId },
    });

    if (patient?.is_specialty_test_account) {
      throw new BadRequestException('Specialty test accounts cannot be deleted');
    }

    const accountType: DeletedAccountType =
      user.role === UserRole.DOCTOR ? 'doctor' : 'patient';

    const snapshot = this.deletedAccountRepo.create({
      user_id: userId,
      account_type: accountType,
      name: doctor?.name ?? patient?.name ?? user.email,
      email: doctor?.email ?? user.email,
      phone: doctor?.phone ?? patient?.phone ?? null,
      country: doctor?.country ?? patient?.country ?? null,
      speciality_name: doctor?.speciality?.name_en ?? null,
      deleted_by: deletedBy,
    });

    const doctorEntityId = doctor?.id ?? null;

    await this.dataSource.transaction(async (manager) => {
      // AI assistant chats
      await manager.query(
        `DELETE FROM ai_messages WHERE conversation_id IN (
          SELECT id FROM ai_conversations WHERE user_id = $1 OR patient_context_id = $1
        )`,
        [userId],
      );
      await manager.query(
        `DELETE FROM ai_conversations WHERE user_id = $1 OR patient_context_id = $1`,
        [userId],
      );
      await manager.query(`DELETE FROM ai_usage_logs WHERE user_id = $1`, [userId]);

      // Consultations & complaints (user UUIDs)
      await manager.query(
        `DELETE FROM consultation_complaints WHERE patient_id = $1 OR doctor_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM consultations WHERE patient_id = $1 OR doctor_id = $1`,
        [userId],
      );

      // Doctor ↔ patient messaging
      await manager.query(
        `DELETE FROM messages WHERE creator = $1 OR recipient = $1`,
        [userId],
      );
      await manager.query(`DELETE FROM message_emotions WHERE user_id = $1`, [userId]);

      // Medical records owned by this patient user
      await manager.query(`DELETE FROM medical_documents WHERE patient_id = $1`, [
        userId,
      ]);

      if (doctorEntityId) {
        await manager.query(
          `DELETE FROM medical_document_requests WHERE doctor_id = $1`,
          [doctorEntityId],
        );
        await manager.query(
          `DELETE FROM doctor_patient_access WHERE doctor_id = $1`,
          [doctorEntityId],
        );
        await manager.query(`DELETE FROM doctor_reviews WHERE doctor_id = $1`, [
          doctorEntityId,
        ]);
        await manager.query(`DELETE FROM appointments WHERE doctor_id = $1`, [
          doctorEntityId,
        ]);

        const diagnosisRows: { id: string }[] = await manager.query(
          `SELECT id FROM diagnoses WHERE doctor_id = $1`,
          [doctorEntityId],
        );
        for (const row of diagnosisRows) {
          await manager.query(`DELETE FROM symptoms WHERE diagnosis_id = $1`, [
            row.id,
          ]);
          await manager.query(
            `DELETE FROM diagnosis_documents WHERE diagnosis_id = $1`,
            [row.id],
          );
        }
        await manager.query(`DELETE FROM diagnoses WHERE doctor_id = $1`, [
          doctorEntityId,
        ]);

        await manager.query(
          `DELETE FROM prescription_medications WHERE prescription_id IN (
            SELECT id FROM prescriptions WHERE doctor_id = $1
          )`,
          [doctorEntityId],
        );
        await manager.query(`DELETE FROM prescriptions WHERE doctor_id = $1`, [
          doctorEntityId,
        ]);
      }

      // Patient-scoped rows
      await manager.query(
        `DELETE FROM doctor_patient_access WHERE patient_user_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM medical_document_requests WHERE patient_user_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM prescription_medications WHERE prescription_id IN (
          SELECT id FROM prescriptions WHERE patient_user_id = $1
        )`,
        [userId],
      );
      await manager.query(`DELETE FROM prescriptions WHERE patient_user_id = $1`, [
        userId,
      ]);
      await manager.query(`DELETE FROM doctor_reviews WHERE patient_user_id = $1`, [
        userId,
      ]);
      await manager.query(`DELETE FROM appointments WHERE patient_user_id = $1`, [
        userId,
      ]);
      await manager.query(
        `DELETE FROM video_call_sessions WHERE patient_user_id = $1 OR doctor_user_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM intake_exam_instances WHERE patient_user_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM intake_exam_assignments WHERE patient_user_id = $1`,
        [userId],
      );
      await manager.query(
        `DELETE FROM specialty_test_accounts WHERE patient_user_id = $1`,
        [userId],
      );

      await manager.query(`DELETE FROM user_notifications WHERE user_id = $1`, [
        userId,
      ]);
      await manager.query(`DELETE FROM device_tokens WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM payment_intentions WHERE user_id = $1`, [
        userId,
      ]);
      await manager.query(`DELETE FROM app_reviews WHERE user_id = $1`, [userId]);

      if (doctor) {
        if (doctor.default_clinic_id) {
          await manager.query(
            `DELETE FROM clinics WHERE id = $1 AND is_personal = true`,
            [doctor.default_clinic_id],
          );
        }
        await manager.delete(Doctor, { id: doctor.id });
      }

      if (patient) {
        await manager.delete(PatientProfile, { user_id: userId });
      }

      await manager.save(DeletedAccount, snapshot);
      await manager.delete(User, { id: userId });
    });
  }
}
