import { IsNumber, IsPositive, Min } from 'class-validator';

export class CreateDepositDto {
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;
}
