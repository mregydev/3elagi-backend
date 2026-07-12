import { IsInt, Max, Min } from 'class-validator';

export class CreateCardCheckoutDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  amount: number;
}
