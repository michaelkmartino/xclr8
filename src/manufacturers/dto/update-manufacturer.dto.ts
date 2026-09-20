import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class UpdateManufacturerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumberString()
  standardCommissionPct?: string;

  @IsOptional()
  @IsNumberString()
  standardOverageSplitPct?: string;
}
