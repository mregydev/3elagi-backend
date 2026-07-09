import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultationComplaint } from '../entities/consultation-complaint.entity';
import { Consultation } from '../entities/consultation.entity';
import { Message } from '../entities/message.entity';
import { PointsService } from '../points/points.service';
import { UsersService } from '../users/users.service';
import { FileComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(ConsultationComplaint)
    private complaintRepo: Repository<ConsultationComplaint>,
    @InjectRepository(Consultation)
    private consultationRepo: Repository<Consultation>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private points: PointsService,
    private users: UsersService,
  ) {}

  async file(patientUserId: string, dto: FileComplaintDto) {
    const consultation = await this.consultationRepo.findOne({
      where: { id: dto.consultation_id },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    if (consultation.patient_id !== patientUserId) {
      throw new ForbiddenException('Not your consultation');
    }
    if (consultation.status !== 'ended') {
      throw new BadRequestException('You can only complain about ended consultations');
    }
    const existing = await this.complaintRepo.findOne({
      where: { consultation_id: consultation.id },
    });
    if (existing) {
      throw new BadRequestException('A complaint already exists for this consultation');
    }
    const created = this.complaintRepo.create({
      consultation_id: consultation.id,
      patient_id: consultation.patient_id,
      doctor_id: consultation.doctor_id,
      points: consultation.reserved_points,
      reason: dto.reason.trim(),
      status: 'pending',
    });
    const saved = await this.complaintRepo.save(created);
    return { id: saved.id, status: saved.status };
  }

  /** Whether the patient already complained about this consultation. */
  async statusFor(consultationId: string) {
    const c = await this.complaintRepo.findOne({
      where: { consultation_id: consultationId },
    });
    return c ? { exists: true, status: c.status } : { exists: false };
  }

  async listAll() {
    const rows = await this.complaintRepo.find({
      order: { created_at: 'DESC' },
    });
    return Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        consultation_id: c.consultation_id,
        patient_id: c.patient_id,
        doctor_id: c.doctor_id,
        patient_name: await this.users.getDisplayName(c.patient_id),
        doctor_name: await this.users.getDisplayName(c.doctor_id),
        points: c.points,
        reason: c.reason,
        status: c.status,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
      })),
    );
  }

  /** Full consultation thread (patient ⇄ doctor) with timestamps, for admin review. */
  async messagesFor(complaintId: string) {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    const consultation = await this.consultationRepo.findOne({
      where: { id: complaint.consultation_id },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');

    const end = consultation.closed_at ?? new Date();
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where(
        '((m.creator = :p AND m.recipient = :d) OR (m.creator = :d AND m.recipient = :p))',
        { p: complaint.patient_id, d: complaint.doctor_id },
      )
      .andWhere('m.datetime >= :start', { start: consultation.created_at })
      .andWhere('m.datetime <= :end', { end })
      .orderBy('m.datetime', 'ASC')
      .getMany();

    const [patientName, doctorName] = await Promise.all([
      this.users.getDisplayName(complaint.patient_id),
      this.users.getDisplayName(complaint.doctor_id),
    ]);

    return rows.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      attachment_url: m.attachment_url,
      attachment_meta: m.attachment_meta,
      datetime: m.datetime,
      from: m.creator === complaint.patient_id ? 'patient' : 'doctor',
      sender_name: m.creator === complaint.patient_id ? patientName : doctorName,
    }));
  }

  async resolve(complaintId: string, dto: ResolveComplaintDto) {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.status !== 'pending') {
      throw new BadRequestException('Complaint already resolved');
    }

    if (dto.action === 'accept') {
      // Pull the points back from the doctor and return them to the patient.
      await this.points.reverseSettlement(
        complaint.patient_id,
        complaint.doctor_id,
        complaint.points,
      );
      complaint.status = 'accepted';
    } else {
      complaint.status = 'rejected';
    }
    complaint.resolved_at = new Date();
    const saved = await this.complaintRepo.save(complaint);
    return { id: saved.id, status: saved.status };
  }
}
