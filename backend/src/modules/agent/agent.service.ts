import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FunnelStatus } from '@prisma/client';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  async processarMensagem(
    leadId: string,
    mensagemUsuario: string,
    origem: string,
    telegramChatId?: string,
  ): Promise<string> {
    // 1. Verifica o Lead (com evento para contexto completo)
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { event: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
    }

    if (telegramChatId) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { telefone: telegramChatId },
      });
    }

    // 2. Salva a mensagem recebida no banco
    await this.prisma.interaction.create({
      data: {
        leadId,
        tipo: 'MENSAGEM_RECEBIDA',
        origem,
        conteudo: mensagemUsuario,
      },
    });

    // 3. Inicializa o modelo via Factory (Anti Vendor Lock-in)
    const model = this.getLLM();

    // 4. Define as Ferramentas (Tools) — Arsenal completo do funil
    const agendarReuniao = tool(
      async ({ data_hora }: { data_hora: string }) => {
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { status: 'REUNIAO_AGENDADA' },
        });
        return `Reunião agendada com sucesso para ${data_hora}. Status do lead atualizado para REUNIAO_AGENDADA.`;
      },
      {
        name: 'agendar_reuniao',
        description:
          'Agenda uma reunião comercial da Vigil.AI com o lead. Use APENAS quando o lead concordar explicitamente em agendar. Formato da data: ISO 8601.',
        schema: z.object({
          data_hora: z
            .string()
            .describe('Data e hora da reunião no formato ISO 8601'),
        }),
      },
    );

    const confirmarPresenca = tool(
      async () => {
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { status: 'CONFIRMADO' },
        });
        return 'Presença confirmada com sucesso. Status do lead atualizado para CONFIRMADO.';
      },
      {
        name: 'confirmar_presenca',
        description:
          'Confirma a presença do lead no evento Vigil Summit. Use quando o lead disser explicitamente que vai comparecer ao evento.',
        schema: z.object({}),
      },
    );

    const consultarPerfilLead = tool(
      async () => {
        const perfil = await this.prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            nome: true,
            cargo: true,
            empresa: true,
            setor: true,
            tamanhoEmpresa: true,
            dadosBrutosEnriquecimento: true,
            status: true,
            trazAcompanhante: true,
          },
        });
        return JSON.stringify(perfil, null, 2);
      },
      {
        name: 'consultar_perfil_lead',
        description:
          'Consulta o perfil completo do lead no banco, incluindo dados enriquecidos (setor, porte, sinais de interesse em segurança). Use para personalizar a conversa com dados concretos.',
        schema: z.object({}),
      },
    );

    const registrarInteresseEvento = tool(
      async ({ interesse }: { interesse: string }) => {
        await this.prisma.interaction.create({
          data: {
            leadId,
            tipo: 'COMPORTAMENTO_EVENTO',
            origem: 'agent_claude',
            conteudo: `Lead demonstrou interesse em: ${interesse}`,
            metadata: { interesse },
          },
        });
        return `Interesse registrado: ${interesse}. Esse dado será usado para personalizar follow-ups futuros.`;
      },
      {
        name: 'registrar_interesse_evento',
        description:
          'Registra um interesse ou tema específico que o lead mencionou na conversa (ex: LGPD, demo da plataforma, ISO 27001). Use sempre que o lead demonstrar curiosidade sobre um tema específico.',
        schema: z.object({
          interesse: z
            .string()
            .describe(
              'Tema ou interesse demonstrado pelo lead (ex: LGPD, ransomware, demo)',
            ),
        }),
      },
    );

    // Mapa de tools por nome — padrão canônico LangChain para lookup dinâmico
    const tools = [agendarReuniao, confirmarPresenca, consultarPerfilLead, registrarInteresseEvento];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolsByName: Record<string, (typeof tools)[number]> = {};
    for (const t of tools) {
      toolsByName[t.name] = t;
    }
    const modelComFerramentas = model.bindTools(tools);

    // 5. Monta o Prompt de Sistema com Contexto Enriquecido + Chain-of-Thought
    const systemMessage = this.montarPromptSistema(lead);

    // 6. Busca o Histórico do Banco (inclui a mensagem do usuário que acabamos de salvar)
    const interacoes = await this.prisma.interaction.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    // Mapeia para o formato do LangChain
    const historico: BaseMessage[] = interacoes.map((i) =>
      i.tipo === 'MENSAGEM_RECEBIDA'
        ? new HumanMessage(i.conteudo)
        : new AIMessage(i.conteudo),
    );

    // 7. Monta o array final de mensagens (Sistema + Histórico)
    const mensagens: BaseMessage[] = [systemMessage, ...historico];

    // 8. Invoca o modelo
    const respostaIa = await modelComFerramentas.invoke(mensagens);
    let textoResposta = '';

    // 9. Lida com chamadas de ferramenta (Tool Calling) via toolsByName
    if (respostaIa.tool_calls && respostaIa.tool_calls.length > 0) {
      mensagens.push(respostaIa);

      for (const chamada of respostaIa.tool_calls) {
        const toolExecutar = toolsByName[chamada.name];
        if (toolExecutar) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resultado = await (toolExecutar as any).invoke(chamada.args);
          mensagens.push(
            new ToolMessage({
              content: resultado,
              tool_call_id: chamada.id!,
              name: chamada.name,
            }),
          );
        }
      }

      const respostaFinal = await model.invoke(mensagens);
      textoResposta = this.extrairTextoConteudo(respostaFinal.content);
    } else {
      textoResposta = this.extrairTextoConteudo(respostaIa.content);
    }

    // 10. Salva a resposta da IA no banco
    await this.prisma.interaction.create({
      data: {
        leadId,
        tipo: 'MENSAGEM_ENVIADA',
        origem: 'agent_claude',
        conteudo: textoResposta,
      },
    });

    return textoResposta;
  }

  async gerarMensagemProativa(
    leadId: string,
    faseRegua: 'D-3' | 'D-1' | 'D+1',
  ): Promise<{ mensagem: string; leadId: string; telegramChatId: string | null }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { event: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
    }

    const model = this.getLLM();

    const prompt = this.montarPromptRegua(lead, faseRegua);

    const resposta = await model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(
        'Gere APENAS a mensagem final para o lead. Nada de introduções, explicações ou metadados. Apenas o texto que será enviado.',
      ),
    ]);

    const textoMensagem = this.extrairTextoConteudo(resposta.content);

    await this.prisma.interaction.create({
      data: {
        leadId,
        tipo: 'MENSAGEM_ENVIADA',
        origem: 'agent_claude',
        conteudo: textoMensagem,
        metadata: { faseRegua },
      },
    });

    await this.atualizarStatusRegua(lead, faseRegua);

    return { mensagem: textoMensagem, leadId, telegramChatId: lead.telefone };
  }

  /**
   * Monta o SystemMessage com contexto enriquecido e raciocínio estruturado (Chain-of-Thought).
   * Injeta dados de enriquecimento (setor, porte, sinais de interesse) para personalização real.
   */
  private montarPromptSistema(lead: {
    nome: string;
    cargo: string | null;
    empresa: string | null;
    setor: string | null;
    tamanhoEmpresa: string | null;
    dadosBrutosEnriquecimento: unknown;
    status: string;
    event?: { nome: string; dataEvento: Date | null } | null;
  }): SystemMessage {
    const dados = lead.dadosBrutosEnriquecimento as Record<string, unknown> | null;
    const sinais = Array.isArray(dados?.sinaisInteresseSeguranca)
      ? (dados.sinaisInteresseSeguranca as string[]).join(', ')
      : 'N/D';

    return new SystemMessage(
      `Você é o agente autônomo da Vigil.AI — uma plataforma SaaS de monitoramento contínuo de postura de cibersegurança.

## Perfil do Lead
- Nome: ${lead.nome}
- Cargo: ${lead.cargo ?? 'Executivo'}
- Empresa: ${lead.empresa ?? 'N/D'} (Setor: ${lead.setor ?? 'N/D'}, Porte: ${lead.tamanhoEmpresa ?? 'N/D'})
- Sinais de interesse em segurança: ${sinais}
- Status atual no funil: ${lead.status}
- Evento: ${lead.event?.nome ?? 'Vigil Summit'}

## Raciocínio Estruturado (pense antes de responder)
Antes de cada resposta, avalie internamente:
1. Em qual fase do funil este lead está? (CAPTADO → ENRIQUECIDO → ENGAGED_PRE → CONFIRMADO → PRESENTE → ENGAGED_POS → REUNIAO_AGENDADA)
2. Qual é o objetivo imediato da próxima interação para avançar o funil?
3. Quais dados do perfil enriquecido posso usar para personalizar esta mensagem?
4. Alguma ferramenta deve ser acionada agora ou devo apenas conversar?

## Ferramentas Disponíveis
- **agendar_reuniao**: Agenda reunião comercial. Use APENAS quando o lead concordar explicitamente.
- **confirmar_presenca**: Confirma presença no evento. Use quando o lead disser que vai comparecer.
- **consultar_perfil_lead**: Consulta dados completos do lead. Use para buscar informações antes de personalizar.
- **registrar_interesse_evento**: Registra interesse do lead em um tema. Use quando ele mencionar curiosidade sobre algo específico.

## Regras
- Responda de forma concisa, corporativa e amigável.
- Use os sinais de interesse para personalizar (ex: se LGPD está nos sinais, mencione compliance).
- Nunca invente dados sobre o lead — use consultar_perfil_lead se precisar de mais informações.
- Nunca force o agendamento — avance o funil gradualmente.
- Respostas em português do Brasil.`,
    );
  }

  private montarPromptRegua(
    lead: {
      nome: string;
      cargo: string | null;
      empresa: string | null;
      setor: string | null;
      status: string;
      dadosBrutosEnriquecimento?: unknown;
      event?: { nome: string; dataEvento: Date | null } | null;
    },
    faseRegua: 'D-3' | 'D-1' | 'D+1',
  ): string {
    const nome = lead.nome;
    const cargo = lead.cargo ?? 'Executivo';
    const empresa = lead.empresa ?? 'sua empresa';
    const setor = lead.setor ?? 'tecnologia';
    const eventoNome = lead.event?.nome ?? 'Vigil Summit';
    const dados = lead.dadosBrutosEnriquecimento as Record<string, unknown> | null;
    const sinais = Array.isArray(dados?.sinaisInteresseSeguranca)
      ? (dados.sinaisInteresseSeguranca as string[]).join(', ')
      : '';
    const contextSinais = sinais
      ? `\nSinais de interesse em segurança detectados: ${sinais}. Use esses sinais para personalizar a mensagem.`
      : '';

    const prompts: Record<string, string> = {
      'D-3': `Você é o agente autônomo da Vigil.AI especializado em engajamento pré-evento.
ESTAMOS NA RÉGUA D-3: Faltam 3 dias para o ${eventoNome}.

Seu objetivo: criar ANTECIPAÇÃO e RELEVÂNCIA.
- Mencione que falta pouco para o ${eventoNome}
- Personalize com o cargo do lead (${cargo}) e setor (${setor})
- Destaque um tema do evento relevante para o perfil dele (ex: LGPD, vazamento de dados, ISO 27001)
- NÃO peça confirmação agora — apenas gere expectativa
- Tom: entusiasmado mas corporativo

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).${contextSinais}
Responda APENAS com a mensagem final para o lead.`,

      'D-1': `Você é o agente autônomo da Vigil.AI especializado em confirmação de presença.
ESTAMOS NA RÉGUA D-1: Véspera do ${eventoNome}. O evento é AMANHÃ.

Seu objetivo: CONFIRMAR PRESENÇA e REDUZIR NO-SHOW.
- Reforce que o ${eventoNome} é amanhã
- Peça explicitamente que ele confirme presença
- Mencione detalhes práticos (horário, local — invente se necessário)
- Crie senso de urgência (vagas limitadas, networking exclusivo)
- Tom: direto e profissional

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).${contextSinais}
Responda APENAS com a mensagem final para o lead.`,

      'D+1': `Você é o agente autônomo da Vigil.AI especializado em follow-up comercial pós-evento.
ESTAMOS NA RÉGUA D+1: O ${eventoNome} aconteceu ONTEM.

Seu objetivo: AGENDAR UMA REUNIÃO COMERCIAL para apresentar a plataforma Vigil.AI.
- Agradeça pela presença no ${eventoNome} (se o lead estava presente)
- Referencie temas do evento que conectam com o perfil dele (${cargo}, ${setor})
- Ofereça uma demonstração personalizada da plataforma
- Sugira ativamente agendar uma reunião
- Se o lead NÃO compareceu, ofereça um resumo exclusivo e convide para uma demo privada
- Tom: consultivo e orientado a valor

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).${contextSinais}
Responda APENAS com a mensagem final para o lead.`,
    };

    return prompts[faseRegua];
  }

  private async atualizarStatusRegua(
    lead: { id: string; status: string },
    faseRegua: 'D-3' | 'D-1' | 'D+1',
  ): Promise<void> {
    const transicoes: Record<string, Record<string, FunnelStatus>> = {
      ENRIQUECIDO: { 'D-3': 'ENGAGED_PRE' },
      ENGAGED_PRE: { 'D-1': 'ENGAGED_PRE' },
      CONFIRMADO: { 'D+1': 'NO_SHOW' },
      PRESENTE: { 'D+1': 'ENGAGED_POS' },
    };

    const novoStatus = transicoes[lead.status]?.[faseRegua];
    if (novoStatus) {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { status: novoStatus },
      });
    }
  }

  /**
   * Factory de LLM: retorna o modelo apropriado conforme LLM_PROVIDER.
   * Evita Vendor Lock-in — alterna entre Anthropic (Claude) e Google (Gemini) via variável de ambiente.
   */
  private getLLM() {
    const provider = process.env.LLM_PROVIDER ?? 'anthropic';

    if (provider === 'gemini') {
      return new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        temperature: 0.7,
      });
    }

    return new ChatAnthropic({
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
    });
  }

  /**
   * Extrai texto legível do content de uma mensagem do LangChain.
   * O content pode ser string pura OU array de content blocks (ex: Anthropic retorna [{type:'text', text:'...'}, {type:'tool_use',...}]).
   * Sem esta extração, cast `as string` grava "[object Object]" no banco quando o content é um array.
   */
  private extrairTextoConteudo(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      const blocos = content as Array<{ type: string; text?: string }>;
      return blocos
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text!)
        .join('');
    }
    return '';
  }
}
