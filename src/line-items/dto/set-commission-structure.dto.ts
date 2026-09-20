import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

// Sets/overrides this quote version's commission & overage split for one
// manufacturer — every line item on this version using that manufacturer
// picks up the new rate (2026-09-19).
export class SetCommissionStructureDto {
  @IsUUID()
  manufacturerId!: string;

  @IsNumberString()
  commissionPct!: string;

  @IsNumberString()
  overageSplitPct!: string;

  @IsOptional()
  @IsString()
  editedBy?: string;
}
