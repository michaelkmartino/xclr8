import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

// Free-form inline cell edits from the Line Items grid — every field is
// optional since only the one cell the user changed is sent (2026-09-19).
export class UpdateLineItemDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsString()
  fixtureType?: string;

  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  partDescription?: string;

  @IsOptional()
  @IsNumberString()
  dnBase?: string;

  @IsOptional()
  @IsString()
  noteText?: string;

  @IsOptional()
  @IsBoolean()
  internalOnly?: boolean;

  @IsOptional()
  @IsString()
  editedBy?: string;
}
