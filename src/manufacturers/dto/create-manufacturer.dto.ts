import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateManufacturerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumberString()
  standardCommissionPct?: string;

  @IsOptional()
  @IsNumberString()
  standardOverageSplitPct?: string;
}
