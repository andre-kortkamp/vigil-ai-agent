import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export type FaseRegua = 'D-3' | 'D-1' | 'D+1';

export const FASES_REGUA: FaseRegua[] = ['D-3', 'D-1', 'D+1'];

export class CampanhaWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(FASES_REGUA, { message: 'faseRegua deve ser D-3, D-1 ou D+1' })
  faseRegua: FaseRegua;
}
