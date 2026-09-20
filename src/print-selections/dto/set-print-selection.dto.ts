import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class SetPrintSelectionDto {
  @IsUUID()
  customerId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  selectedColumnOrder!: number;
}
