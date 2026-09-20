import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(['individual', 'group'])
  type?: 'individual' | 'group';
}
