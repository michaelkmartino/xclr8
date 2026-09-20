import { IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLineItemDto {
  @IsInt()
  @Min(1)
  lineNumber!: number;

  @IsNumberString()
  quantity!: string;

  @IsString()
  fixtureType!: string;

  @IsUUID()
  manufacturerId!: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  partDescription?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNumberString()
  dnBase!: string;

  @IsOptional()
  @IsNumberString()
  commissionPct?: string;

  @IsOptional()
  @IsNumberString()
  overageSplitPct?: string;

  @IsOptional()
  @IsString()
  editedBy?: string; // whoever is working as, per the UI's "Working as" identity
}
