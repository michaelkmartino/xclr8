import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

/**
 * Two shapes share this one DTO/endpoint, distinguished by `isNote`
 * (confirmed 2026-09-19):
 *  - a normal fixture line: quantity/fixtureType/manufacturerId/dnBase
 *    required, lineNumber and commission/overage are never client-supplied
 *    (server assigns the line number and auto-populates commission from the
 *    Manufacturer's standard rate or this quote's Commission Structure).
 *  - a Note row (isNote: true): just free-text noteText plus the
 *    internalOnly flag that keeps it off printed/sent quotes.
 */
export class CreateLineItemDto {
  @IsOptional()
  @IsBoolean()
  isNote?: boolean;

  @ValidateIf((o) => !o.isNote)
  @IsNumberString()
  quantity?: string;

  @ValidateIf((o) => !o.isNote)
  @IsString()
  fixtureType?: string;

  @ValidateIf((o) => !o.isNote)
  @IsUUID()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  partDescription?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateIf((o) => !o.isNote)
  @IsNumberString()
  dnBase?: string;

  @ValidateIf((o) => o.isNote)
  @IsString()
  noteText?: string;

  @IsOptional()
  @IsBoolean()
  internalOnly?: boolean;

  @IsOptional()
  @IsString()
  editedBy?: string; // whoever is working as, per the UI's "Working as" identity
}
