import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AgentService } from '../agent/agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { FunnelStatus, Prisma } from '@prisma/client';
import { MensagemWebhookDto } from './dto/mensagem-webhook.dto';
import { CriarLeadWebhookDto } from './dto/criar-lead-webhook.dto';
import { CampanhaWebhookDto } from './dto/campanha-webhook.dto';
import { RevogarLgpdDto } from './dto/revogar-lgpd.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly agentService: AgentService,
    private readonly prisma: PrismaService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Post('n8n')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Processar mensagem do lead via n8n/Telegram',
    description: `Endpoint principal de comunicação do agente. Recebe mensagens do lead via integração n8n → Telegram Bot e retorna a resposta personalizada gerada pela LLM.

**Fluxo interno:**
1. Resolve o lead por \`leadId\` ou \`telegramChatId\` (lookup automático)
2. Persiste a mensagem recebida no histórico de interações (memória do agente)
3. Monta o prompt com contexto enriquecido (setor, porte, sinais de interesse) + Chain-of-Thought
4. Invoca a LLM com tool calling — o agente pode acionar: \`confirmar_presenca\`, \`agendar_reuniao\`, \`consultar_perfil_lead\`, \`registrar_interesse_evento\`
5. Persiste a resposta da IA e retorna ao n8n para envio via Telegram`,
  })
  @ApiResponse({
    status: 200,
    description: 'Resposta do agente gerada com sucesso',
    schema: {
      type: 'object',
      properties: {
        resposta: {
          type: 'string',
          example: 'Olá Ricardo! Que bom que você se interessou pelo Vigil Summit. Como CISO do Nubank, acredito que a palestra sobre LGPD e SOC 2 será especialmente relevante para vocês. Posso confirmar sua presença?',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'É necessário enviar `leadId` ou `telegramChatId`' })
  @ApiResponse({ status: 404, description: 'Lead não encontrado para o Telegram ID informado' })
  async receberMensagemN8n(
    @Body() dto: MensagemWebhookDto,
  ): Promise<{ resposta: string }> {
    let leadId = dto.leadId;

    // Se o n8n não enviar leadId (ex: resposta genérica do Telegram como 'confirmado')
    if (!leadId && dto.telegramChatId) {
      const lead = await this.prisma.lead.findFirst({
        where: { telefone: dto.telegramChatId },
      });
      if (!lead) {
        throw new NotFoundException('Lead não encontrado para este Telegram ID');
      }
      leadId = lead.id;
    }

    if (!leadId) {
      throw new BadRequestException('É necessário enviar leadId ou telegramChatId');
    }

    const resposta = await this.agentService.processarMensagem(
      leadId,
      dto.mensagemUsuario,
      dto.origem,
      dto.telegramChatId,
    );
    return { resposta };
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Captar novo lead (Fase 1 do funil)',
    description: `Inscreve um novo lead no funil do Vigil Summit. Após a criação, o enriquecimento automático (Fase 2) é disparado de forma assíncrona — o lead é atualizado com dados de setor, porte e sinais de interesse em segurança.

**Retorna** o link do Telegram Bot para o lead iniciar a comunicação com o agente.

**Fluxo:** Landing Page → Este endpoint → Enriquecimento assíncrono → Lead pronto para régua D-3`,
  })
  @ApiResponse({
    status: 201,
    description: 'Lead captado com sucesso. Enriquecimento disparado em background',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        leadId: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        linkTelegram: { type: 'string', example: 'https://t.me/VigilSummitBot?start=a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      },
    },
  })
  async criarLead(
    @Body() dto: CriarLeadWebhookDto,
  ): Promise<{ success: boolean; leadId: string; linkTelegram: string }> {
    const lead = await this.prisma.lead.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        cargo: dto.cargo,
        empresa: dto.empresa,
        eventId: dto.eventId,
        status: 'CAPTADO',
      },
    });

    void this.enrichmentService.enriquecerLead(lead.id);

    return {
      success: true,
      leadId: lead.id,
      linkTelegram: `https://t.me/VigilSummitBot?start=${lead.id}`,
    };
  }

  @Post('enriquecer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enriquecer lead manualmente (Fase 2 do funil)',
    description: `Dispara o enriquecimento de um lead específico. Consulta dados públicos (simulados via Apollo.io/Clearbit) para obter: setor, tamanho da empresa, faturamento estimado, sinais de interesse em segurança e presença em redes sociais.

O enriquecimento alimenta a personalização de TODAS as comunicações do agente — é o que diferencia uma mensagem genérica de uma personalizada.

**Nota:** O enriquecimento automático já acontece na captação. Use este endpoint para re-enriquecimento manual.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['leadId'],
      properties: {
        leadId: {
          type: 'string',
          description: 'ID do lead (UUID) a ser enriquecido',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Lead enriquecido com sucesso', schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } })
  @ApiResponse({ status: 400, description: '`leadId` é obrigatório' })
  async enriquecerLead(
    @Body('leadId') leadId: string,
  ): Promise<{ success: boolean }> {
    if (!leadId) {
      throw new BadRequestException('leadId é obrigatório');
    }
    await this.enrichmentService.enriquecerLead(leadId);
    return { success: true };
  }

  @Post('revogar-lgpd')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar consentimento LGPD — anonimização de dados',
    description: `Endpoint de compliance LGPD (Lei Geral de Proteção de Dados). Ao ser invocado, anonimiza **irreversivelmente** todos os dados pessoais do lead:

- **Nome** → "Anônimo (LGPD)"
- **E-mail** → "revogado-{hash}@anonimo.lgpd"
- **Telefone, LinkedIn, Cargo, Empresa** → null
- **Dados de enriquecimento** → null
- **lgpdConsent** → false

Uma interação de auditoria é registrada no histórico para rastreabilidade.`,
  })
  @ApiResponse({ status: 200, description: 'Dados anonimizados com sucesso' })
  @ApiResponse({ status: 404, description: 'Lead não encontrado' })
  async revogarLgpd(
    @Body() dto: RevogarLgpdDto,
  ): Promise<{ success: boolean }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${dto.leadId} não encontrado`);
    }

    await this.prisma.lead.update({
      where: { id: dto.leadId },
      data: {
        nome: 'Anônimo (LGPD)',
        email: `revogado-${dto.leadId.slice(0, 8)}@anonimo.lgpd`,
        telefone: null,
        linkedinUrl: null,
        cargo: null,
        empresa: null,
        dadosBrutosEnriquecimento: Prisma.JsonNull,
        lgpdConsent: false,
      },
    });

    await this.prisma.interaction.create({
      data: {
        leadId: dto.leadId,
        tipo: 'MUDANCA_STATUS',
        origem: 'system',
        conteudo: 'Consentimento LGPD revogado. Dados pessoais anonimizados.',
        metadata: { motivo: 'revogacao_lgpd', emailOriginal: lead.email },
      },
    });

    return { success: true };
  }

  @Post('campanha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disparar campanha proativa da régua de comunicação (Fases 3 e 4)',
    description: `Dispara mensagens proativas da régua de comunicação para leads elegíveis. O agente gera cada mensagem com personalização baseada no perfil enriquecido.

### Lógica de Negócio por Fase

| Fase | Objetivo | Leads elegíveis | Transição de status |
|------|----------|-----------------|---------------------|
| **D-3** | Criar antecipação com tema relevante ao setor do lead | \`ENRIQUECIDO\` | → \`ENGAGED_PRE\` |
| **D-1** | Confirmar presença com urgência (vagas limitadas, networking) | \`ENGAGED_PRE\` | mantém |
| **D+1** | Follow-up personalizado + agendamento de reunião comercial | \`CONFIRMADO\`, \`PRESENTE\` | → \`ENGAGED_POS\` ou \`NO_SHOW\` |

### Modos de operação
- **Individual**: Envie \`leadId\` para disparar apenas para um lead específico
- **Broadcast**: Omita \`leadId\` para disparar para todos os leads elegíveis do evento`,
  })
  @ApiResponse({
    status: 200,
    description: 'Campanha disparada com sucesso — retorna mensagem gerada para cada lead',
    schema: {
      type: 'object',
      properties: {
        resultados: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              leadId: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
              mensagem: { type: 'string', example: 'Ricardo, faltam 3 dias para o Vigil Summit! Como CISO do Nubank, a palestra sobre conformidade SOC 2 foi pensada especialmente para o seu contexto.' },
              telegramChatId: { type: 'string', nullable: true, example: '123456789' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Fase de régua inválida (deve ser D-3, D-1 ou D+1)' })
  async dispararCampanha(
    @Body() dto: CampanhaWebhookDto,
  ): Promise<{ resultados: Array<{ leadId: string; mensagem: string; telegramChatId: string | null }> }> {
    if (dto.leadId) {
      const resultado = await this.agentService.gerarMensagemProativa(
        dto.leadId,
        dto.faseRegua,
      );
      return { resultados: [resultado] };
    }

    const statusPorFase: Record<string, FunnelStatus[]> = {
      'D-3': ['ENRIQUECIDO'],
      'D-1': ['ENGAGED_PRE'],
      'D+1': ['CONFIRMADO', 'PRESENTE'],
    };

    const statusElegiveis = statusPorFase[dto.faseRegua];
    if (!statusElegiveis) {
      throw new BadRequestException(`Fase de régua inválida: ${dto.faseRegua}`);
    }

    const leads = await this.prisma.lead.findMany({
      where: {
        eventId: dto.eventId,
        status: { in: statusElegiveis },
      },
      select: { id: true },
    });

    const resultados = await Promise.all(
      leads.map((l) =>
        this.agentService.gerarMensagemProativa(l.id, dto.faseRegua),
      ),
    );

    return { resultados };
  }
}
