import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DoctorTagsService } from './doctor-tags.service';

@Controller('doctor-tags')
export class DoctorTagsController {
  constructor(private readonly service: DoctorTagsService) {}

  @Get('resolve')
  @Public()
  resolve(
    @Query('labels') labelsRaw?: string,
    @Query('locale') locale?: string,
  ) {
    const labels = (labelsRaw ?? '')
      .split('|')
      .map((label) => label.trim())
      .filter(Boolean);
    return this.service.resolveLabels(labels, locale);
  }

  @Get()
  @Public()
  list(
    @Query('speciality_ids') specialityIdsRaw?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('locale') locale?: string,
  ) {
    const specialityIds = (specialityIdsRaw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.service.listSuggestions({
      specialityIds,
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      locale,
    });
  }
}
