import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { FunnelStatus, Prisma } from '@prisma/client';
import { MensagemWebhookDto } from './dto/mensagem-webhook.dto';
import { CriarLeadWebhookDto } from './dto/criar-lead-webhook.dto';
import { CampanhaWebhookDto } from './dto/campanha-webhook.dto';
import { RevogarLgpdDto } from './dto/revogar-lgpd.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly agentService: AgentService,
    private readonly prisma: PrismaService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Post('n8n')
  @HttpCode(HttpStatus.OK)
  async receberMensagemN8n(
    @Body() dto: MensagemWebhookDto,
  ): Promise<{ resposta: string }> {
    const resposta = await this.agentService.processarMensagem(
      dto.leadId,
      dto.mensagemUsuario,
      dto.origem,
      dto.telegramChatId,
    );
    return { resposta };
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
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
  async dispararCampanha(
    @Body() dto: CampanhaWebhookDto,
  ): Promise<{ resultados: Array<{ leadId: string; mensagem: string }> }> {
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
