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
import { Clinic } from '../entities/clinic.entity';

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(ClinicJoinRequest)
    private requestRepo: Repository<ClinicJoinRequest>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
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

  async findByClinicForAdmin(clinicId: string, adminUserId: string, status?: JoinRequestStatus) {
    await this.assertClinicOwner(clinicId, adminUserId);
    const where: Partial<ClinicJoinRequest> & { status?: JoinRequestStatus } = { clinic_id: clinicId };
    if (status) where.status = status;
    return this.requestRepo.find({ where });
  }

  async findByUserId(userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) return [];
    return this.requestRepo.find({ where: { doctor_id: doctor.id } });
  }

  async findByDoctor(doctorId: string, adminUserId: string) {
    const adminClinics = await this.clinicRepo.find({ where: { owner_id: adminUserId } });
    const adminClinicIds = adminClinics.map((c) => c.id);
    if (adminClinicIds.length === 0) throw new ForbiddenException('No clinics found for this admin');
    const requests = await this.requestRepo.find({ where: { doctor_id: doctorId } });
    const filtered = requests.filter((r) => adminClinicIds.includes(r.clinic_id));
    if (filtered.length === 0 && requests.length > 0) {
      throw new ForbiddenException('No join requests for this doctor in your clinics');
    }
    return filtered;
  }

  async approve(requestId: string, adminUserId: string) {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    await this.assertClinicOwner(request.clinic_id, adminUserId);

    request.status = JoinRequestStatus.APPROVED;
    await this.requestRepo.save(request);

    await this.doctorRepo.update(request.doctor_id, {
      default_clinic_id: request.clinic_id,
    });

    return request;
  }

  async reject(requestId: string, adminUserId: string) {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    await this.assertClinicOwner(request.clinic_id, adminUserId);

    request.status = JoinRequestStatus.REJECTED;
    return this.requestRepo.save(request);
  }

  private async assertClinicOwner(clinicId: string, userId: string): Promise<void> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    if (clinic.owner_id !== userId) {
      throw new ForbiddenException('You do not own this clinic');
    }
  }
}
