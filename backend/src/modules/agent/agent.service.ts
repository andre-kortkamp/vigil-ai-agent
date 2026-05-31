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
    // 1. Verifica o Lead
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
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

    // 4. Define as Ferramentas (Tools)
    const agendarReuniao = tool(
      async ({ data_hora }: { data_hora: string }) => {
        // Atualiza o status do Lead no banco de dados para a Fase 4 do Funil
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { status: 'REUNIAO_AGENDADA' }, // Certifique-se que 'REUNIAO_AGENDADA' existe no seu Enum do schema
        });
        return `Reunião agendada no banco de dados com sucesso para ${data_hora}.`;
      },
      {
        name: 'agendar_reuniao',
        description:
          'Agenda uma reunião comercial da Vigil.AI com o lead. Use quando o lead demonstrar interesse explícito em marcar uma reunião. Formato: ISO 8601.',
        schema: z.object({
          data_hora: z
            .string()
            .describe('Data e hora da reunião no formato ISO 8601'),
        }),
      },
    );

    const modelComFerramentas = model.bindTools([agendarReuniao]);

    // 5. Monta o Prompt de Sistema com o Contexto (Personalização - PDF)
    const systemMessage = new SystemMessage(
      `Você é o agente autônomo da Vigil.AI falando com ${lead.nome} (Cargo: ${lead.cargo ?? 'Executivo'}). 
Seu objetivo é avançar o lead no funil até agendar uma reunião comercial sobre nossa plataforma de cibersegurança.
Responda de forma concisa, corporativa, mas amigável.`,
    );

    // 6. Busca o Histórico do Banco (agora INCLUI a mensagem do usuário que acabamos de salvar)
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
    // NOTA: Não precisamos dar push na mensagemUsuario de novo, pois ela já está no histórico.
    const mensagens: BaseMessage[] = [systemMessage, ...historico];

    // 8. Invoca o modelo
    const respostaIa = await modelComFerramentas.invoke(mensagens);
    let textoResposta = '';

    // 9. Lida com chamadas de ferramenta (Tool Calling)
    if (respostaIa.tool_calls && respostaIa.tool_calls.length > 0) {
      mensagens.push(respostaIa);

      for (const chamada of respostaIa.tool_calls) {
        if (chamada.name === 'agendar_reuniao') {
          // Fazemos o casting explícito para a assinatura que o Zod/Tool espera
          const args = chamada.args as { data_hora: string };

          // Executa a função da ferramenta de forma segura para o TypeScript
          const resultado = await agendarReuniao.invoke(args);

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
  ): Promise<{ mensagem: string; leadId: string }> {
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

    return { mensagem: textoMensagem, leadId };
  }

  private montarPromptRegua(
    lead: {
      nome: string;
      cargo: string | null;
      empresa: string | null;
      setor: string | null;
      status: string;
      event?: { nome: string; dataEvento: Date | null } | null;
    },
    faseRegua: 'D-3' | 'D-1' | 'D+1',
  ): string {
    const nome = lead.nome;
    const cargo = lead.cargo ?? 'Executivo';
    const empresa = lead.empresa ?? 'sua empresa';
    const setor = lead.setor ?? 'tecnologia';
    const eventoNome = lead.event?.nome ?? 'Vigil Summit';

    const prompts: Record<string, string> = {
      'D-3': `Você é o agente autônomo da Vigil.AI especializado em engajamento pré-evento.
ESTAMOS NA RÉGUA D-3: Faltam 3 dias para o ${eventoNome}.

Seu objetivo: criar ANTECIPAÇÃO e RELEVÂNCIA.
- Mencione que falta pouco para o ${eventoNome}
- Personalize com o cargo do lead (${cargo}) e setor (${setor})
- Destaque um tema do evento relevante para o perfil dele (ex: LGPD, vazamento de dados, ISO 27001)
- NÃO peça confirmação agora — apenas gere expectativa
- Tom: entusiasmado mas corporativo

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).
Responda APENAS com a mensagem final para o lead.`,

      'D-1': `Você é o agente autônomo da Vigil.AI especializado em confirmação de presença.
ESTAMOS NA RÉGUA D-1: Véspera do ${eventoNome}. O evento é AMANHÃ.

Seu objetivo: CONFIRMAR PRESENÇA e REDUZIR NO-SHOW.
- Reforce que o ${eventoNome} é amanhã
- Peça explicitamente que ele confirme presença
- Mencione detalhes práticos (horário, local — invente se necessário)
- Crie senso de urgência (vagas limitadas, networking exclusivo)
- Tom: direto e profissional

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).
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

Lead: ${nome}, ${cargo} na ${empresa} (setor: ${setor}).
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
