import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User, UserRole } from '../entities/user.entity';

export type AccessActionType =
  | 'grant_records'
  | 'revoke_records'
  | 'patient_block'
  | 'doctor_block'
  | 'patient_unblock'
  | 'doctor_unblock';

export interface DoctorPatientAccessStatus {
  patient_user_id: string;
  doctor_id: string;
  doctor_user_id: string;
  records_allowed: boolean;
  blocked_by_patient: boolean;
  blocked_by_doctor: boolean;
  is_blocked: boolean;
  records_allowed_at: string | null;
}

@Injectable()
export class DoctorPatientAccessService {
  constructor(
    @InjectRepository(DoctorPatientAccess)
    private accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
  ) {}

  private async isSpecialtyTestPatient(patientUserId: string): Promise<boolean> {
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
      select: { is_specialty_test_account: true },
    });
    return profile?.is_specialty_test_account === true;
  }

  private grantedTestPatientStatus(
    patientUserId: string,
    doctor: Doctor,
    recordsAllowedAt: Date | null = new Date(),
  ): DoctorPatientAccessStatus {
    return {
      patient_user_id: patientUserId,
      doctor_id: doctor.id,
      doctor_user_id: doctor.user_id,
      records_allowed: true,
      blocked_by_patient: false,
      blocked_by_doctor: false,
      is_blocked: false,
      records_allowed_at: recordsAllowedAt.toISOString(),
    };
  }

  private mapStatus(
    row: DoctorPatientAccess,
    doctorUserId: string,
  ): DoctorPatientAccessStatus {
    return {
      patient_user_id: row.patient_user_id,
      doctor_id: row.doctor_id,
      doctor_user_id: doctorUserId,
      records_allowed: row.records_allowed,
      blocked_by_patient: row.blocked_by_patient,
      blocked_by_doctor: row.blocked_by_doctor,
      is_blocked: row.blocked_by_patient || row.blocked_by_doctor,
      records_allowed_at: row.records_allowed_at?.toISOString() ?? null,
    };
  }

  private defaultStatus(
    patientUserId: string,
    doctor: Doctor,
  ): DoctorPatientAccessStatus {
    return {
      patient_user_id: patientUserId,
      doctor_id: doctor.id,
      doctor_user_id: doctor.user_id,
      records_allowed: false,
      blocked_by_patient: false,
      blocked_by_doctor: false,
      is_blocked: false,
      records_allowed_at: null,
    };
  }

  async resolveDoctorFromUserId(doctorUserId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: doctorUserId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  async findOrCreate(patientUserId: string, doctorId: string): Promise<DoctorPatientAccess> {
    let row = await this.accessRepo.findOne({
      where: { patient_user_id: patientUserId, doctor_id: doctorId },
    });
    if (!row) {
      row = this.accessRepo.create({
        patient_user_id: patientUserId,
        doctor_id: doctorId,
        records_allowed: false,
        blocked_by_patient: false,
        blocked_by_doctor: false,
      });
      row = await this.accessRepo.save(row);
    }
    return row;
  }

  async getStatusForPeer(userId: string, peerUserId: string): Promise<DoctorPatientAccessStatus> {
    const [self, peer] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.userRepo.findOne({ where: { id: peerUserId } }),
    ]);
    if (!self || !peer) throw new NotFoundException('User not found');

    const roles = new Set([self.role, peer.role]);
    if (
      !roles.has(UserRole.DOCTOR) ||
      !roles.has(UserRole.PATIENT) ||
      roles.size !== 2
    ) {
      throw new BadRequestException('Access status is only for doctor-patient pairs');
    }

    const patientUserId = self.role === UserRole.PATIENT ? self.id : peer.id;
    const doctorUserId = self.role === UserRole.DOCTOR ? self.id : peer.id;
    const doctor = await this.resolveDoctorFromUserId(doctorUserId);

    if (await this.isSpecialtyTestPatient(patientUserId)) {
      const row = await this.accessRepo.findOne({
        where: { patient_user_id: patientUserId, doctor_id: doctor.id },
      });
      return this.grantedTestPatientStatus(
        patientUserId,
        doctor,
        row?.records_allowed_at ?? new Date(),
      );
    }

    const row = await this.accessRepo.findOne({
      where: { patient_user_id: patientUserId, doctor_id: doctor.id },
    });
    if (!row) return this.defaultStatus(patientUserId, doctor);
    return this.mapStatus(row, doctor.user_id);
  }

  async assertCanChat(senderId: string, recipientId: string): Promise<void> {
    const status = await this.getStatusForPeer(senderId, recipientId);
    if (status.is_blocked) {
      throw new ForbiddenException('Chat is blocked between these users');
    }
  }

  async assertDoctorCanPrescribeForPatient(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<Doctor> {
    const doctor = await this.resolveDoctorFromUserId(doctorUserId);
    if (await this.isSpecialtyTestPatient(patientUserId)) {
      return doctor;
    }
    const row = await this.findOrCreate(patientUserId, doctor.id);

    if (row.blocked_by_patient || row.blocked_by_doctor) {
      throw new ForbiddenException('Chat is blocked between these users');
    }
    return doctor;
  }

  async assertPatientUser(patientUserId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: patientUserId } });
    if (!user || user.role !== UserRole.PATIENT) {
      throw new NotFoundException('Patient user not found');
    }
    return user;
  }

  async assertDoctorCanEditRecords(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    if (await this.isSpecialtyTestPatient(patientUserId)) return;

    const doctor = await this.resolveDoctorFromUserId(doctorUserId);
    const row = await this.findOrCreate(patientUserId, doctor.id);

    if (row.blocked_by_patient || row.blocked_by_doctor) {
      throw new ForbiddenException('Chat is blocked between these users');
    }
    if (!row.records_allowed) {
      throw new ForbiddenException(
        'Patient has not granted permission to access medical records',
      );
    }
  }

  async applyAccessAction(
    actorUserId: string,
    peerUserId: string,
    action: AccessActionType,
  ): Promise<DoctorPatientAccessStatus> {
    const [actor, peer] = await Promise.all([
      this.userRepo.findOne({ where: { id: actorUserId } }),
      this.userRepo.findOne({ where: { id: peerUserId } }),
    ]);
    if (!actor || !peer) throw new NotFoundException('User not found');

    const patientUserId =
      actor.role === UserRole.PATIENT ? actor.id : peer.id;
    const doctorUserId =
      actor.role === UserRole.DOCTOR ? actor.id : peer.id;

    if (actor.role !== UserRole.PATIENT && actor.role !== UserRole.DOCTOR) {
      throw new ForbiddenException('Invalid role');
    }

    const doctor = await this.resolveDoctorFromUserId(doctorUserId);
    const row = await this.findOrCreate(patientUserId, doctor.id);

    if (await this.isSpecialtyTestPatient(patientUserId)) {
      row.records_allowed = true;
      row.records_allowed_at = row.records_allowed_at ?? new Date();
      row.blocked_by_patient = false;
      row.blocked_by_doctor = false;
      const saved = await this.accessRepo.save(row);
      return this.mapStatus(saved, doctor.user_id);
    }

    if (action === 'grant_records') {
      if (actor.role !== UserRole.PATIENT) {
        throw new ForbiddenException('Only the patient can grant record access');
      }
      if (row.blocked_by_patient || row.blocked_by_doctor) {
        throw new ForbiddenException('Cannot grant access while chat is blocked');
      }
      row.records_allowed = true;
      row.records_allowed_at = new Date();
    } else if (action === 'revoke_records') {
      if (actor.role !== UserRole.PATIENT) {
        throw new ForbiddenException('Only the patient can revoke record access');
      }
      row.records_allowed = false;
      row.records_allowed_at = null;
    } else if (action === 'patient_block') {
      if (actor.role !== UserRole.PATIENT) {
        throw new ForbiddenException('Only the patient can block the doctor');
      }
      row.blocked_by_patient = true;
      row.records_allowed = false;
      row.records_allowed_at = null;
    } else if (action === 'doctor_block') {
      if (actor.role !== UserRole.DOCTOR) {
        throw new ForbiddenException('Only the doctor can block the patient');
      }
      row.blocked_by_doctor = true;
    } else if (action === 'patient_unblock') {
      if (actor.role !== UserRole.PATIENT) {
        throw new ForbiddenException('Only the patient can unblock the doctor');
      }
      row.blocked_by_patient = false;
    } else if (action === 'doctor_unblock') {
      if (actor.role !== UserRole.DOCTOR) {
        throw new ForbiddenException('Only the doctor can unblock the patient');
      }
      row.blocked_by_doctor = false;
    } else {
      throw new BadRequestException('Invalid access action');
    }

    const saved = await this.accessRepo.save(row);
    return this.mapStatus(saved, doctor.user_id);
  }

  static accessActionLabel(action: AccessActionType, isRTL = false): string {
    const labels: Record<AccessActionType, { en: string; ar: string }> = {
      grant_records: {
        en: 'Granted access to medical records',
        ar: 'تم منح صلاحية الوصول للسجل الطبي',
      },
      revoke_records: {
        en: 'Revoked access to medical records',
        ar: 'تم إلغاء صلاحية الوصول للسجل الطبي',
      },
      patient_block: {
        en: 'Patient blocked this chat',
        ar: 'قام المريض بحظر هذه المحادثة',
      },
      doctor_block: {
        en: 'Doctor blocked this chat',
        ar: 'قام الطبيب بحظر هذه المحادثة',
      },
      patient_unblock: {
        en: 'Patient unblocked this chat',
        ar: 'أزال المريض الحظر عن هذه المحادثة',
      },
      doctor_unblock: {
        en: 'Doctor unblocked this chat',
        ar: 'أزال الطبيب الحظر عن هذه المحادثة',
      },
    };
    return isRTL ? labels[action].ar : labels[action].en;
  }
}
