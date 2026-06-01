import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para captação de leads via landing page ou formulário.
 * Fase 1 do funil — ponto de entrada do lead no sistema.
 */
export class CriarLeadWebhookDto {
  @ApiProperty({
    description: 'Nome completo do lead (decisor de TI/Segurança)',
    example: 'Ricardo Mendes',
  })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({
    description: 'E-mail corporativo do lead — usado como identificador único',
    example: 'ricardo.mendes@nubank.com.br',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Cargo do lead na empresa (CISO, CTO, Diretor de TI, etc.)',
    example: 'CISO',
  })
  @IsString()
  @IsNotEmpty()
  cargo: string;

  @ApiProperty({
    description: 'Nome da empresa do lead — usado no enriquecimento automático para detecção de setor, porte e sinais de interesse',
    example: 'Nubank',
  })
  @IsString()
  @IsNotEmpty()
  empresa: string;

  @ApiProperty({
    description: 'ID do evento (UUID) ao qual o lead está se inscrevendo. Suporta multi-evento para escala regional',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;
}
