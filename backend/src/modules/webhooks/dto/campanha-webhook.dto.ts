import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FaseRegua = 'D-3' | 'D-1' | 'D+1';

export const FASES_REGUA: FaseRegua[] = ['D-3', 'D-1', 'D+1'];

/**
 * DTO para disparo de campanhas proativas da régua de comunicação.
 * O agente gera mensagens personalizadas com base no perfil enriquecido do lead.
 *
 * ### Régua de Comunicação
 * | Fase | Objetivo | Leads elegíveis |
 * |------|----------|-----------------|
 * | **D-3** | Criar antecipação e relevância | `ENRIQUECIDO` |
 * | **D-1** | Confirmar presença e reduzir no-show | `ENGAGED_PRE` |
 * | **D+1** | Follow-up pós-evento e agendamento de reunião | `CONFIRMADO`, `PRESENTE` |
 */
export class CampanhaWebhookDto {
  @ApiProperty({
    description: 'ID do evento (UUID) para filtrar os leads elegíveis à campanha',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional({
    description: 'ID de um lead específico (UUID). Se enviado, dispara a campanha apenas para este lead. Se omitido, dispara para todos os leads elegíveis do evento',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsString()
  @IsOptional()
  leadId?: string;

  @ApiProperty({
    description: 'Fase da régua de comunicação. Cada fase tem lógica de negócio distinta: **D-3** (antecipação), **D-1** (confirmação de presença), **D+1** (follow-up comercial)',
    enum: FASES_REGUA,
    example: 'D-3',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(FASES_REGUA, { message: 'faseRegua deve ser D-3, D-1 ou D+1' })
  faseRegua: FaseRegua;
}
