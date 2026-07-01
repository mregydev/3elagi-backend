import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TtsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;
}
