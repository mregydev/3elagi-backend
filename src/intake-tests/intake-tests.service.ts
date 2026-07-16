import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  IntakeTest,
  IntakeQuestion,
  IntakeOption,
  IntakeQuestionType,
} from '../entities/intake-test.entity';
import { Doctor } from '../entities/doctor.entity';

const ALLOWED_TYPES: IntakeQuestionType[] = [
  'text',
  'single_choice',
  'multi_choice',
  'image',
  'video',
  'audio',
  'guidance',
];
const CHOICE_TYPES: IntakeQuestionType[] = ['single_choice', 'multi_choice'];

interface UpsertDto {
  name: string;
  description?: string;
  is_active?: boolean;
  questions: IntakeQuestion[];
}

interface AnyOldQuestion {
  id?: string;
  text?: string;
  text_ar?: string;
  text_en?: string;
  type?: string;
  required?: boolean;
  options?: AnyOldOption[];
}
interface AnyOldOption {
  id?: string;
  text?: string;
  text_ar?: string;
  text_en?: string;
}

function mapOldType(t: string | undefined): IntakeQuestionType {
  switch (t) {
    case 'text':
    case 'single_choice':
    case 'multi_choice':
    case 'image':
    case 'video':
    case 'audio':
    case 'guidance':
      return t;
    case 'radio':
      return 'single_choice';
    case 'checkbox':
    case 'select':
      return 'multi_choice';
    case 'textarea':
    case 'number':
    case 'date':
    case 'document':
    default:
      return 'text';
  }
}

@Injectable()
export class IntakeTestsService {
  constructor(
    @InjectRepository(IntakeTest) private repo: Repository<IntakeTest>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
  ) {}

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  private validateName(name: unknown): string {
    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestException('Test name is required');
    }
    return name.trim();
  }

  normalizeQuestions(qsInput: unknown): IntakeQuestion[] {
    if (!Array.isArray(qsInput)) {
      throw new BadRequestException('questions must be an array');
    }
    const cleaned = (qsInput as AnyOldQuestion[])
      .map<IntakeQuestion | null>((q) => {
        const text = (q.text ?? q.text_ar ?? q.text_en ?? '').trim();
        if (!text) return null;
        const type = mapOldType(q.type);
        const options = Array.isArray(q.options) ? q.options : [];
        const cleanedOpts = options
          .map<IntakeOption | null>((o) => {
            const t = (o.text ?? o.text_ar ?? o.text_en ?? '').trim();
            if (!t) return null;
            return { id: o.id || randomUUID(), text: t };
          })
          .filter((o): o is IntakeOption => !!o);
        if (CHOICE_TYPES.includes(type) && cleanedOpts.length < 2) {
          throw new BadRequestException(
            'Choice-type questions must have at least two options',
          );
        }
        return {
          id: q.id || randomUUID(),
          text,
          type,
          required: type === 'guidance' ? false : !!q.required,
          options: CHOICE_TYPES.includes(type) ? cleanedOpts : [],
        };
      })
      .filter((q): q is IntakeQuestion => !!q);
    if (cleaned.length < 1) {
      throw new BadRequestException(
        'Intake test must contain at least one question',
      );
    }
    return cleaned;
  }

  async list(userId: string): Promise<IntakeTest[]> {
    const doctor = await this.getDoctor(userId);
    return this.repo.find({
      where: { doctor_id: doctor.id },
      order: { updated_at: 'DESC' },
    });
  }

  async create(dto: UpsertDto, userId: string): Promise<IntakeTest> {
    const doctor = await this.getDoctor(userId);
    const name = this.validateName(dto?.name);
    const questions = this.normalizeQuestions(dto?.questions);
    const test = this.repo.create({
      doctor_id: doctor.id,
      name,
      description:
        typeof dto?.description === 'string'
          ? dto.description.trim() || null
          : null,
      is_active: dto?.is_active !== false,
      is_default_template: false,
      questions,
    });
    return this.repo.save(test);
  }

  async update(
    id: string,
    dto: UpsertDto,
    userId: string,
  ): Promise<IntakeTest> {
    const doctor = await this.getDoctor(userId);
    const test = await this.repo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Intake test not found');
    if (test.doctor_id !== doctor.id) {
      throw new ForbiddenException('Not your intake test');
    }
    test.name = this.validateName(dto?.name);
    test.description =
      typeof dto?.description === 'string'
        ? dto.description.trim() || null
        : null;
    test.is_active = dto?.is_active !== false;
    test.questions = this.normalizeQuestions(dto?.questions);
    return this.repo.save(test);
  }

  async remove(id: string, userId: string): Promise<{ ok: true }> {
    const doctor = await this.getDoctor(userId);
    const test = await this.repo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Intake test not found');
    if (test.doctor_id !== doctor.id) {
      throw new ForbiddenException('Not your intake test');
    }
    await this.repo.delete(id);
    return { ok: true };
  }
}
