import { IsString, IsNotEmpty } from 'class-validator';

export class MensagemWebhookDto {
  @IsString()
  @IsNotEmpty()
  leadId: string;

  @IsString()
  @IsNotEmpty()
  mensagemUsuario: string;

  @IsString()
  @IsNotEmpty()
  origem: string;
}
