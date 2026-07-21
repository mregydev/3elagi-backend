import { IsInt, Max, Min } from 'class-validator';

/** Body for card checkout — `amount` is points (credits) to buy, not cash. */
export class CreateCardCheckoutDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  amount: number;
}
