import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateVersionDto {
  @IsOptional()
  @IsString()
  label?: string; // short free-text reason, e.g. "revised drawings 9/19"

  @IsOptional()
  copyFromVersionId?: string; // if omitted, copies from the current reporting version

  // User's explicit choice, asked at "create new version" time: copy the
  // existing version's line items/pricing, or start completely empty. When
  // true, copyFromVersionId is ignored and nothing is copied (2026-09-19).
  @IsOptional()
  @IsBoolean()
  blank?: boolean;
}
