import { IsInt, IsNumberString, IsString, Max, Min } from 'class-validator';

export class CreatePriceColumnDto {
  @IsString()
  columnLabel!: string;

  @IsNumberString()
  multiplier!: string; // e.g. "1.15" for 15% markup on DN

  @IsInt()
  @Min(1)
  @Max(10) // up to 10 price columns per line item, confirmed in the spec
  columnOrder!: number;
}
