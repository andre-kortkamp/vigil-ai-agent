import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de eventos do Vigil Summit.
 * Suporta eventos regionais simultâneos com perfis de público distintos (manufatura, saúde, financeiro, governo).
 */
export class CreateEventDto {
  @ApiProperty({
    description: 'Nome do evento — identifica a edição regional do Summit',
    example: 'Vigil Summit SP — Segurança para a Era da IA',
  })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({
    description: 'Data do evento em formato ISO 8601. Essencial para cálculo automático das fases da régua (D-3, D-1, D+1)',
    example: '2026-07-15T09:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  dataEvento: string;

  @ApiPropertyOptional({
    description: 'Público-alvo do evento — usado para personalização das mensagens do agente (ex: manufatura, saúde, financeiro, governo)',
    example: 'CISOs e CTOs de empresas do setor financeiro com mais de 200 funcionários',
  })
  @IsString()
  @IsOptional()
  publicoAlvo?: string;
}
