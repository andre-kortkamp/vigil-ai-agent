import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // ==========================================
  // Swagger / OpenAPI — Documentação da API Vigil.AI
  // ==========================================
  const config = new DocumentBuilder()
    .setTitle('Vigil.AI Agent API')
    .setDescription(
      `API do agente autônomo de IA da **Vigil.AI** para gerenciamento do funil completo do **Vigil Summit — Segurança para a Era da IA**.

## Visão Geral
O agente gerencia um pipeline de 4 fases para maximizar conversão de leads em reuniões comerciais:

| Fase | Descrição | Status do Funil |
|------|-----------|-----------------|
| **1. Captação** | Inscrição do lead via landing page / formulário | \`CAPTADO\` |
| **2. Enriquecimento** | Enriquecimento automático com dados públicos (cargo, setor, porte, sinais de interesse em segurança) | \`ENRIQUECIDO\` |
| **3. Engajamento Pré-Evento** | Régua de confirmação (D-3, D-1) para reduzir no-show — meta: >70% de comparecimento | \`ENGAGED_PRE\` → \`CONFIRMADO\` |
| **4. Follow-up Pós-Evento** | Régua de follow-up personalizado (D+1) para agendamento de reunião comercial | \`ENGAGED_POS\` → \`REUNIAO_AGENDADA\` |

## Arquitetura Agentic
- **LLM**: Claude 3.5 Sonnet (Anthropic) ou Gemini 2.5 Flash (Google) — alternável via \`LLM_PROVIDER\`
- **Framework**: LangChain (tool calling + memória de contexto)
- **Tools**: \`agendar_reuniao\`, \`confirmar_presenca\`, \`consultar_perfil_lead\`, \`registrar_interesse_evento\`
- **Chain-of-Thought**: Raciocínio estruturado injeta contexto enriquecido no prompt para personalização real

## Canais de Comunicação
O agente se comunica via **Telegram Bot** integrado ao **n8n** (workflow automation).
Os webhooks desta API recebem mensagens do n8n e retornam respostas geradas pelo agente.

## Compliance LGPD
Endpoint dedicado para revogação de consentimento com anonimização completa de dados pessoais.`,
    )
    .setVersion('1.0.0')
    .addTag(
      'Webhooks',
      'Endpoints de integração com n8n/Telegram — processamento de mensagens, captação de leads, campanhas e compliance LGPD',
    )
    .addTag(
      'Eventos',
      'Gerenciamento de eventos do Vigil Summit — criação e configuração de eventos regionais',
    )
    .setExternalDoc(
      'Documento do Case — Pareto AI Engineer',
      'https://github.com/andre-kortkamp/vigil-ai-agent/blob/main/README.md',
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    customSiteTitle: 'Vigil.AI Agent — API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
