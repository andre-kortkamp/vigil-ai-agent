import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface DadosEnriquecidos {
  tamanhoEmpresa: string;
  setor: string;
  sinaisInteresseSeguranca: string[];
  presencaRedes: string[];
  faturamentoEstimado: string;
  fonte: string;
}

const MOCK_EMPRESAS: Record<string, DadosEnriquecidos> = {
  nubank: {
    tamanhoEmpresa: '5000+',
    setor: 'Financeiro',
    sinaisInteresseSeguranca: ['LGPD', 'SOC 2', 'vazamento_dados'],
    presencaRedes: ['linkedin', 'twitter'],
    faturamentoEstimado: 'R$ 8Bi+',
    fonte: 'Apollo.io (simulado)',
  },
  itau: {
    tamanhoEmpresa: '10000+',
    setor: 'Financeiro',
    sinaisInteresseSeguranca: ['ISO 27001', 'bacen', 'fraude_digital'],
    presencaRedes: ['linkedin'],
    faturamentoEstimado: 'R$ 150Bi+',
    fonte: 'Clearbit (simulado)',
  },
  petrobras: {
    tamanhoEmpresa: '20000+',
    setor: 'Energia',
    sinaisInteresseSeguranca: [
      'infraestrutura_critica',
      'ransomware',
      'ISO 27001',
    ],
    presencaRedes: ['linkedin', 'twitter'],
    faturamentoEstimado: 'R$ 640Bi+',
    fonte: 'Apollo.io (simulado)',
  },
  hospital: {
    tamanhoEmpresa: '2000+',
    setor: 'Saúde',
    sinaisInteresseSeguranca: ['LGPD', 'dados_sensiveis', 'ransomware'],
    presencaRedes: ['linkedin'],
    faturamentoEstimado: 'R$ 500M+',
    fonte: 'Clearbit (simulado)',
  },
  vw: {
    tamanhoEmpresa: '5000+',
    setor: 'Manufatura',
    sinaisInteresseSeguranca: ['OT_security', 'IoT', 'cadeia_suprimentos'],
    presencaRedes: ['linkedin'],
    faturamentoEstimado: 'R$ 30Bi+',
    fonte: 'Apollo.io (simulado)',
  },
  volkswagen: {
    tamanhoEmpresa: '5000+',
    setor: 'Manufatura',
    sinaisInteresseSeguranca: ['OT_security', 'IoT', 'cadeia_suprimentos'],
    presencaRedes: ['linkedin'],
    faturamentoEstimado: 'R$ 30Bi+',
    fonte: 'Apollo.io (simulado)',
  },
  ambev: {
    tamanhoEmpresa: '3000+',
    setor: 'Bens de Consumo',
    sinaisInteresseSeguranca: ['ISO 27001', 'cadeia_suprimentos', 'SOC 2'],
    presencaRedes: ['linkedin', 'instagram'],
    faturamentoEstimado: 'R$ 80Bi+',
    fonte: 'Clearbit (simulado)',
  },
  magalu: {
    tamanhoEmpresa: '4000+',
    setor: 'Varejo',
    sinaisInteresseSeguranca: ['LGPD', 'fraude_digital', 'vazamento_dados'],
    presencaRedes: ['linkedin', 'twitter'],
    faturamentoEstimado: 'R$ 60Bi+',
    fonte: 'Apollo.io (simulado)',
  },
  governo: {
    tamanhoEmpresa: '10000+',
    setor: 'Governo',
    sinaisInteresseSeguranca: [
      'LGPD',
      'infraestrutura_critica',
      'ISO 27001',
      'bacen',
    ],
    presencaRedes: ['linkedin'],
    faturamentoEstimado: 'N/A (Setor Público)',
    fonte: 'Clearbit (simulado)',
  },
};

const DEFAULT_ENRICHMENT: DadosEnriquecidos = {
  tamanhoEmpresa: '200-500',
  setor: 'Tecnologia',
  sinaisInteresseSeguranca: ['LGPD', 'vazamento_dados'],
  presencaRedes: ['linkedin'],
  faturamentoEstimado: 'R$ 50M-200M',
  fonte: 'Apollo.io (simulado)',
};

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enriquecerLead(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      this.logger.warn(`Lead ${leadId} não encontrado para enriquecimento`);
      return;
    }

    if (lead.status !== 'CAPTADO') {
      this.logger.debug(
        `Lead ${leadId} já está em ${lead.status}, ignorando enriquecimento`,
      );
      return;
    }

    this.logger.log(
      `Iniciando enriquecimento do lead ${lead.nome} (${lead.empresa ?? 'N/D'})`,
    );

    const dados = this.buscarDadosEmpresa(lead.empresa ?? '');

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        tamanhoEmpresa: dados.tamanhoEmpresa,
        setor: dados.setor,
        dadosBrutosEnriquecimento: {
          fonte: dados.fonte,
          faturamentoEstimado: dados.faturamentoEstimado,
          sinaisInteresseSeguranca: dados.sinaisInteresseSeguranca,
          presencaRedes: dados.presencaRedes,
          enriquecidoEm: new Date().toISOString(),
        },
        status: 'ENRIQUECIDO',
      },
    });

    await this.prisma.interaction.create({
      data: {
        leadId,
        tipo: 'MUDANCA_STATUS',
        origem: 'system',
        conteudo: `Lead enriquecido com dados públicos. Setor: ${dados.setor}. Tamanho: ${dados.tamanhoEmpresa}. Fonte: ${dados.fonte}.`,
        metadata: {
          statusAnterior: 'CAPTADO',
          statusNovo: 'ENRIQUECIDO',
          ...dados,
        },
      },
    });

    this.logger.log(`Lead ${lead.nome} enriquecido com sucesso → ENRIQUECIDO`);
  }

  private buscarDadosEmpresa(empresa: string): DadosEnriquecidos {
    const chave = empresa.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const [palavraChave, dados] of Object.entries(MOCK_EMPRESAS)) {
      if (chave.includes(palavraChave)) {
        return dados;
      }
    }

    return DEFAULT_ENRICHMENT;
  }
}
