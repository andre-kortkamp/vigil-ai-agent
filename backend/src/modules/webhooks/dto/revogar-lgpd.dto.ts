import { IsString, IsNotEmpty } from 'class-validator';

export class RevogarLgpdDto {
  @IsString()
  @IsNotEmpty()
  leadId: string;
}
