import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateJobDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
