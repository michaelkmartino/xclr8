import { IsUUID } from 'class-validator';

export class AddGroupMemberDto {
  @IsUUID()
  memberCustomerId!: string;
}
