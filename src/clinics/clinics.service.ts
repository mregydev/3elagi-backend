import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../entities/clinic.entity';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { Doctor } from '../entities/doctor.entity';
import { ClinicJoinRequest, JoinRequestStatus } from '../entities/clinic-join-request.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(ClinicJoinRequest) private joinRequestRepo: Repository<ClinicJoinRequest>,
  ) {}

  async findAll() {
    return this.clinicRepo.find({ where: { is_personal: false } });
  }

  async findById(id: string) {
    const clinic = await this.clinicRepo.findOne({ where: { id } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async getDashboard(clinicId: string, adminUserId: string) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    if (clinic.owner_id !== adminUserId) {
      throw new ForbiddenException('You do not own this clinic');
    }
    const today = new Date().toISOString().split('T')[0];

    const [appointmentsToday, doctorCount, pendingRequests] = await Promise.all([
      this.appointmentRepo.count({
        where: { clinic_id: clinicId, date: today },
      }),
      this.doctorRepo.count({ where: { default_clinic_id: clinicId } }),
      this.joinRequestRepo.count({
        where: { clinic_id: clinicId, status: JoinRequestStatus.PENDING },
      }),
    ]);

    return { appointmentsToday, doctorCount, pendingRequests };
  }

  async create(dto: CreateClinicDto, ownerId: string) {
    const clinic = this.clinicRepo.create({ ...dto, owner_id: ownerId });
    return this.clinicRepo.save(clinic);
  }

  async update(id: string, updates: Partial<CreateClinicDto>, adminUserId: string) {
    const clinic = await this.clinicRepo.findOne({ where: { id } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    if (clinic.owner_id !== adminUserId) throw new ForbiddenException('You do not own this clinic');
    await this.clinicRepo.update(id, updates);
    return this.clinicRepo.findOne({ where: { id } });
  }
}
