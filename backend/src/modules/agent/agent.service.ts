import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ajuste o path se necessário
import { ChatAnthropic } from '@langchain/anthropic';
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
  constructor(private readonly prisma: PrismaService) { }

  async processarMensagem(
    leadId: string,
    mensagemUsuario: string,
    origem: string,
  ): Promise<string> {
    // 1. Verifica o Lead
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
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

    // 3. Inicializa o Claude (usando as chaves nativas do LangChain)
    const model = new ChatAnthropic({
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      // A chave é puxada automaticamente do process.env.ANTHROPIC_API_KEY
    });

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
