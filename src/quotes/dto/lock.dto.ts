import { IsString } from 'class-validator';

export class LockDto {
  @IsString()
  userName!: string; // stand-in until real login/auth exists
}
