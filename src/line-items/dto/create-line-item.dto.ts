import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

const LINE_TYPES = ['item', 'note', 'description', 'blank', 'subtotal'] as const;

/**
 * One endpoint, five row shapes, distinguished by `lineType` (2026-09-19):
 *  - 'item': a priced fixture line. quantity/fixtureType/manufacturerId/
 *    dnBase required. lineNumber and commission/overage are never
 *    client-supplied.
 *  - 'note' / 'description': free-text noteText, tied to the fixture line
 *    above via parentLineItemId. Notes respect internalOnly; descriptions
 *    always print and are never shaded.
 *  - 'blank': an empty spacer line, no other fields needed.
 *  - 'subtotal': no fields needed — its amount is always computed fresh
 *    from the item lines above it, never stored.
 */
export class CreateLineItemDto {
  @IsOptional()
  @IsIn(LINE_TYPES)
  lineType?: (typeof LINE_TYPES)[number];

  @ValidateIf((o) => !o.lineType || o.lineType === 'item')
  @IsNumberString()
  quantity?: string;

  @ValidateIf((o) => !o.lineType || o.lineType === 'item')
  @IsString()
  fixtureType?: string;

  @ValidateIf((o) => !o.lineType || o.lineType === 'item')
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

  @ValidateIf((o) => !o.lineType || o.lineType === 'item')
  @IsNumberString()
  dnBase?: string;

  @ValidateIf((o) => o.lineType === 'note' || o.lineType === 'description')
  @IsString()
  noteText?: string;

  @IsOptional()
  @IsBoolean()
  internalOnly?: boolean;

  @IsOptional()
  @IsString()
  editedBy?: string; // whoever is working as, per the UI's "Working as" identity
}
