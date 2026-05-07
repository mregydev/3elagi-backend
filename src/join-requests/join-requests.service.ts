import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicJoinRequest,
  JoinRequestStatus,
} from '../entities/clinic-join-request.entity';
import { Doctor } from '../entities/doctor.entity';

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(ClinicJoinRequest)
    private requestRepo: Repository<ClinicJoinRequest>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
  ) {}

  async getDoctorIdByUserId(userId: string): Promise<string | null> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    return doctor ? doctor.id : null;
  }

  async requestToJoin(doctorId: string, clinicId: string) {
    const existing = await this.requestRepo.findOne({
      where: { doctor_id: doctorId, clinic_id: clinicId, status: JoinRequestStatus.PENDING },
    });
    if (existing) throw new ConflictException('Request already pending');

    const request = this.requestRepo.create({
      doctor_id: doctorId,
      clinic_id: clinicId,
      status: JoinRequestStatus.PENDING,
    });
    return this.requestRepo.save(request);
  }

  async findByClinic(clinicId: string, status?: JoinRequestStatus) {
    const where: Partial<ClinicJoinRequest> & { status?: JoinRequestStatus } = { clinic_id: clinicId };
    if (status) where.status = status;
    return this.requestRepo.find({ where });
  }

  async findByUserId(userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) return [];
    return this.requestRepo.find({ where: { doctor_id: doctor.id } });
  }

  async findByDoctor(doctorId: string) {
    return this.requestRepo.find({ where: { doctor_id: doctorId } });
  }

  async approve(requestId: string) {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    request.status = JoinRequestStatus.APPROVED;
    await this.requestRepo.save(request);

    await this.doctorRepo.update(request.doctor_id, {
      default_clinic_id: request.clinic_id,
    });

    return request;
  }

  async reject(requestId: string) {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    request.status = JoinRequestStatus.REJECTED;
    return this.requestRepo.save(request);
  }
}
