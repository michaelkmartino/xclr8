import { IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  bidPackage?: string; // defaults to "Base Bid" in the schema
}
