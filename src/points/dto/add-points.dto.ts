import { IsInt, Max, Min } from 'class-validator';

export class AddPointsDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  amount: number;
}
