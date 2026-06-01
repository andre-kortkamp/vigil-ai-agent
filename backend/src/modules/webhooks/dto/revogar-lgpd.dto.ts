import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para revogação de consentimento LGPD.
 * Anonimiza completamente os dados pessoais do lead (nome, e-mail, telefone, LinkedIn, dados de enriquecimento).
 * A operação é irreversível e registra uma interação de auditoria no histórico.
 */
export class RevogarLgpdDto {
  @ApiProperty({
    description: 'ID do lead (UUID) cujo consentimento LGPD será revogado. Os dados pessoais serão anonimizados irreversivelmente',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  leadId: string;
}
