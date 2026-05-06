import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import { Doctor } from '../entities/doctor.entity';
import { PrescriptionItem } from '../entities/prescription.entity';

interface UpsertDto {
  name: string;
  title?: string;
  symptoms?: string;
  items: PrescriptionItem[];
}

@Injectable()
export class PrescriptionTemplatesService {
  constructor(
    @InjectRepository(PrescriptionTemplate)
    private repo: Repository<PrescriptionTemplate>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
  ) {}

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  async list(userId: string): Promise<PrescriptionTemplate[]> {
    const doctor = await this.getDoctor(userId);
    return this.repo.find({
      where: { doctor_id: doctor.id },
      order: { updated_at: 'DESC' },
    });
  }

  async create(dto: UpsertDto, userId: string): Promise<PrescriptionTemplate> {
    const doctor = await this.getDoctor(userId);
    const tpl = this.repo.create({
      doctor_id: doctor.id,
      name: dto.name.trim(),
      title: dto.title?.trim() || null,
      symptoms: dto.symptoms?.trim() || null,
      items: (dto.items || []).filter((i) => i?.name?.trim()),
    });
    return this.repo.save(tpl);
  }

  async update(id: string, dto: UpsertDto, userId: string): Promise<PrescriptionTemplate> {
    const doctor = await this.getDoctor(userId);
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.doctor_id !== doctor.id) throw new ForbiddenException('Not your template');
    tpl.name = dto.name.trim();
    tpl.title = dto.title?.trim() || null;
    tpl.symptoms = dto.symptoms?.trim() || null;
    tpl.items = (dto.items || []).filter((i) => i?.name?.trim());
    return this.repo.save(tpl);
  }

  async remove(id: string, userId: string): Promise<{ ok: true }> {
    const doctor = await this.getDoctor(userId);
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.doctor_id !== doctor.id) throw new ForbiddenException('Not your template');
    await this.repo.delete(id);
    return { ok: true };
  }
}
