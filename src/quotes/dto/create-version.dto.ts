import { IsOptional, IsString } from 'class-validator';

export class CreateVersionDto {
  @IsOptional()
  @IsString()
  label?: string; // short free-text reason, e.g. "revised drawings 9/19"

  @IsOptional()
  copyFromVersionId?: string; // if omitted, copies from the current reporting version
}
