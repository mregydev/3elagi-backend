import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advertisement } from '../entities/advertisement.entity';

@Injectable()
export class AdvertisementsService {
  constructor(
    @InjectRepository(Advertisement)
    private adRepo: Repository<Advertisement>,
  ) {}

  async findAll() {
    const rows = await this.adRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', created_at: 'DESC' },
      relations: ['clinic'],
    });

    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      banner_image_url: a.banner_image_url,
      clinic_id: a.clinic_id,
      clinic_name: a.clinic?.name ?? null,
    }));
  }
}
