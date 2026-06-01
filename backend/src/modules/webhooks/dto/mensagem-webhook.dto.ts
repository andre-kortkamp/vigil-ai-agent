import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para processamento de mensagens recebidas via n8n/Telegram.
 * O agente recebe a mensagem, consulta o histórico e responde com personalização baseada em enriquecimento.
 */
export class MensagemWebhookDto {
  @ApiPropertyOptional({
    description: 'ID do lead (UUID). Opcional se `telegramChatId` for enviado — o sistema faz lookup automático',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiProperty({
    description: 'Texto da mensagem enviada pelo lead ao agente',
    example: 'Olá, gostaria de confirmar minha presença no Vigil Summit',
  })
  @IsString()
  @IsNotEmpty()
  mensagemUsuario: string;

  @ApiProperty({
    description: 'Canal de origem da mensagem (ex: `n8n_telegram`, `n8n_email`, `api_direta`)',
    example: 'n8n_telegram',
  })
  @IsString()
  @IsNotEmpty()
  origem: string;

  @ApiPropertyOptional({
    description: 'ID do chat no Telegram — usado para lookup de lead quando `leadId` não está disponível e para envio de respostas via bot',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
