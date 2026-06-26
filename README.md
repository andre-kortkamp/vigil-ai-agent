# Vigil AI Agent

Agente autônomo de IA para gestão do funil corporativo B2B da Vigil.AI — do lead à reunião agendada.

Case técnico — AI Engineer, Pareto (2026).

---

## Links Rápidos para Avaliação

| Recurso | URL |
|---|---|
| **Dashboard (Next.js)** | [https://vigil-ai-agent.vercel.app](https://vigil-ai-agent.vercel.app/) — acesso protegido por senha |
| **Formulário de Inscrição (n8n)** | [Inscrever lead no Vigil Summit](https://andre-kortkamp.app.n8n.cloud/form/11b01538-6848-482c-9a1d-d810cf512465) |
| **API — Swagger/OpenAPI** | [https://vigil-ai-agent.onrender.com/api/docs](https://vigil-ai-agent.onrender.com/api/docs) |
| **Repositório** | [github.com/andre-kortkamp/vigil-ai-agent](https://github.com/andre-kortkamp/vigil-ai-agent) |
| **Telegram Bot** | [@VigilSummitBot](https://t.me/VigilSummitBot) |

> **Nota:** API em produção no Render: `https://vigil-ai-agent.onrender.com`. Para rodar local: `http://localhost:3000`.

---

## Guia de Teste (Passo a Passo)

### Teste rápido — fluxo completo

**1. Inscreva-se como lead:**

Acesse o [formulário de inscrição](https://andre-kortkamp.app.n8n.cloud/form/11b01538-6848-482c-9a1d-d810cf512465) e preencha com dados de teste (ex: Ramon, ramon@pareto.io, CTO, Pareto). O n8n captura os dados e chama `POST /webhooks/leads` automaticamente.

**2. Converse com o agente no Telegram:**

Após a inscrição, clique no link do Telegram Bot que aparece na resposta (ou acesse [@VigilSummitBot](https://t.me/VigilSummitBot)). Envie `/start` e depois converse naturalmente — o agente já tem seu perfil enriquecido.

**3. Simule a régua de comunicação via API:**

Abra o [Swagger UI](https://vigil-ai-agent.onrender.com/api/docs) e dispare campanhas proativas:

```bash
# D-3 — Antecipação (3 dias antes do evento)
curl -X POST https://vigil-ai-agent.onrender.com/webhooks/campanha \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<UUID>", "leadId":"<UUID>", "faseRegua":"D-3"}'

# D-1 — Confirmação de presença (véspera)
curl -X POST https://vigil-ai-agent.onrender.com/webhooks/campanha \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<UUID>", "leadId":"<UUID>", "faseRegua":"D-1"}'

# D+1 — Follow-up comercial (pós-evento)
curl -X POST https://vigil-ai-agent.onrender.com/webhooks/campanha \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<UUID>", "leadId":"<UUID>", "faseRegua":"D+1"}'
```

**4. Explore a documentação da API:**

Acesse [https://vigil-ai-agent.onrender.com/api/docs](https://vigil-ai-agent.onrender.com/api/docs) — toda a API está documentada com Swagger/OpenAPI, incluindo exemplos de request/response para cada endpoint.

### O que observar durante o teste

- **Personalização real:** as mensagens do agente mencionam o cargo, empresa e setor do lead (dados vindos do enriquecimento)
- **Tool calling:** no chat do Telegram, diga "quero confirmar minha presença" → o agente aciona a ferramenta `confirmar_presenca` e atualiza o status no banco
- **Memória:** o agente lembra do contexto de mensagens anteriores
- **Transição de status:** cada interação avança o lead no funil (verificável no Supabase ou via Swagger)

---

## 1. Arquitetura da Solução

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────────────┐
│  Mundo Externo  │     │  Orquestração (n8n)  │     │   Motor Cognitivo       │
│                 │     │                      │     │   (NestJS)              │
│ • Formulário    │────▶│ • Webhook: Novo Lead │────▶│ • WebhooksController    │
│   n8n Cloud     │     │ • Cron D-3/D-1/D+1   │     │ • AgentService (Claude) │
│ • Telegram Bot  │◀──▶│ • Bridge Telegram    │◀──▶│ • EnrichmentService     │
│                 │     │                      │     │ • EventsController      │
└─────────────────┘     └─────────────────────┘     └────────┬────────────────┘
                                                             │
                                                    ┌────────▼────────────────┐
                                                    │  Dados                  │
                                                    │  Supabase / PostgreSQL  │
                                                    │  • Event, Lead,         │
                                                    │    Interaction          │
                                                    └─────────────────────────┘
```

### Camadas

| Camada | Componente | Função |
|---|---|---|
| **Entrada** | Formulário n8n Cloud + Telegram Bot | Captura dados do lead e canal de conversa bidirecional |
| **Orquestração** | n8n (3 workflows) | Bridge Telegram↔NestJS, Cron proativo (régua), disparo de mensagens |
| **Processamento** | NestJS (API REST) | 7 endpoints, lógica de funil, integração LLM, tool calling |
| **IA** | Claude 3.5 Sonnet (Anthropic) via LangChain | Geração de mensagens, decisão autônoma, tool calling |
| **Dados** | Supabase PostgreSQL + Prisma ORM | 3 tabelas (`Event`, `Lead`, `Interaction`), 2 enums |

### Fase do funil → Componente → Endpoint

| Fase | O que acontece | Endpoint |
|---|---|---|
| **1. Captação** | Lead preenche formulário → n8n chama a API → cria lead com status `CAPTADO` | `POST /webhooks/leads` |
| **2. Enriquecimento** | Disparado automaticamente após captação. Busca setor, porte, sinais de interesse → `ENRIQUECIDO` | `EnrichmentService` (async) |
| **3. Pré-evento** | Cron do n8n dispara D-3 e D-1 → Claude gera mensagem personalizada → `ENGAGED_PRE` → `CONFIRMADO` | `POST /webhooks/campanha` |
| **4. Pós-evento** | Cron D+1 → follow-up comercial → agendamento de reunião via chat → `REUNIAO_AGENDADA` | `POST /webhooks/campanha` + tool calling |

---

## 2. Stack Tecnológico Justificado

| Tecnologia | Papel | Por que esta e não outra |
|---|---|---|
| **Claude 3.5 Sonnet** (Anthropic) | LLM principal | Case pede preferência pelo ecossistema Anthropic. Melhor custo/benefício para agente conversacional com tool calling. Alternativa descartada: GPT-4o — não atende a preferência explícita |
| **Gemini 2.5 Flash** (Google) | LLM alternativo | Factory pattern com `LLM_PROVIDER` env var permite trocar sem alterar código. Anti vendor lock-in |
| **LangChain** (`@langchain/anthropic`) | Framework de agente | É um dos frameworks mais usados e avançados para tool calling. Abstrai a complexidade e traz velocidade e praticidade para o desenvolvimento do case. Alternativa descartada: SDK nativo (exigiria loop manual). |
| **NestJS** | API REST | Modular (DI nativa), Swagger plugin nativo, ValidationPipe com class-validator. Estrutura enterprise-grade |
| **Supabase PostgreSQL** | Banco de dados | Relacional, auditável, hosting gerenciado com PgBouncer e SSL. Prisma ORM com type-safety e migrations declarativas |
| **n8n** (Cloud) | Orquestração/workflow | Cron auditável (substitui `setInterval`), bridge Telegram, interface visual para debug. Pontua no bônus "low-code/no-code" |
| **Telegram** | Canal de comunicação | Bot API madura, deep linking (`?start=leadId`), webhooks nativos, não requer telefone para iniciar conversa. Alternativa descartada: WhatsApp (pessoal, Meta Business API cara), e-mail (baixa taxa de resposta) |
| **Swagger/OpenAPI** | Documentação da API | Plugin `@nestjs/swagger` com introspecção automática de DTOs e controllers. Acessível em `/api/docs` |
| **Render & Vercel** | Infra de Deploy | Uso dos planos gratuitos (Free Tier) puramente pela simplicidade e velocidade, ideal para testar este case técnico/MVP. |

---

## 3. Réguas de Comunicação

### Pré-evento (Fase 3) — reduzir no-show de 40-60% para <30%

| Gatilho | Condição | Ação | Transição |
|---|---|---|---|
| **D-3** (Antecipação) | Lead `ENRIQUECIDO` | Claude gera mensagem com tema relevante ao setor do lead | `ENRIQUECIDO` → `ENGAGED_PRE` |
| **D-1** (Confirmação) | Lead `ENGAGED_PRE` | Claude pede confirmação explícita com urgência (vagas limitadas) | Mantém `ENGAGED_PRE` até confirmação |

**Exemplo D-3** (Lead: Ramon, CTO da Pareto, setor Financeiro, sinais: LGPD, SOC 2):

> Olá Ramon, faltam 3 dias para o Vigil Summit. Como CTO da Pareto, acredito que você vai se interessar especialmente pelo painel sobre vazamento de dados e conformidade LGPD — temas diretamente conectados aos desafios do setor financeiro. Nos vemos lá?

**Exemplo D-1:**

> Ramon, o Vigil Summit é amanhã. Sua presença como CTO da Pareto está confirmada? As vagas estão limitadas a 120 executivos e a lista de espera já está ativa. Confirme agora para garantir seu lugar.

### Pós-evento (Fase 4) — converter presença em reunião comercial

| Gatilho | Condição | Ação | Transição |
|---|---|---|---|
| **D+1** (Follow-up) | Lead `CONFIRMADO` ou `PRESENTE` | Claude referencia temas do evento + perfil do lead, oferece demo, sugere agendamento | `PRESENTE` → `ENGAGED_POS` / `CONFIRMADO` → `NO_SHOW` |

**Exemplo D+1:**

> Ramon, obrigado por participar do Vigil Summit. Vi que o painel de SOC 2 gerou bastante discussão entre os CISOs presentes. Que tal uma demonstração personalizada da plataforma Vigil.AI para o cenário da Pareto? Posso agendar uma sessão de 30 minutos nesta semana.

### Regras de negócio

1. **Proximidade da data como gatilho:** n8n Cron (09:00 diário) calcula distância entre `hoje` e `Event.dataEvento`. Leads a D-3, D-1 ou D+1 são acionados automaticamente.
2. **Segmentação por status:** cada gatilho só afeta leads no status correto, evitando duplicação.
3. **Personalização por enriquecimento:** toda mensagem usa dados da Fase 2 (cargo, setor, empresa, sinais).
4. **Memória de interações:** histórico completo (`Interaction`) é injetado no prompt do Claude.
5. **Transição automática:** cada disparo avança o lead no funil.

### Fluxo de status

```
CAPTADO → ENRIQUECIDO → ENGAGED_PRE → CONFIRMADO → PRESENTE → ENGAGED_POS → REUNIAO_AGENDADA
              (auto)        (D-3)        (chat)      (check-in)    (D+1)        (tool calling)
                                                         │
                                                         ▼
                                                      NO_SHOW
```

---

## 4. Estratégia de Dados e Personalização

### Coleta

1. **Formulário (Fase 1):** nome, email, cargo, empresa → enviados via `POST /webhooks/leads`
2. **Enriquecimento automático (Fase 2):** disparado em background após captação. Simula APIs (Apollo.io/Clearbit) com dicionário de 9 perfis corporativos reais (Nubank, Itaú, Petrobras, Hospitais, Volkswagen, Ambev, Magalu, Governo) + fallback genérico

### Como o enriquecimento alimenta o agente

Para cada lead, o `EnrichmentService` popula:
- `setor` (ex: "Financeiro") → Claude menciona LGPD e BACEN
- `tamanhoEmpresa` (ex: "5000+") → Tom da mensagem ajustado ao porte
- `sinaisInteresseSeguranca` (ex: ["LGPD", "SOC 2"]) → Claude destaca temas relevantes
- `presencaRedes`, `faturamentoEstimado`, `fonte` → metadados de auditoria

Em produção, basta substituir o dicionário local por chamadas HTTP reais às APIs — mesma interface, mesma assinatura.

### LGPD

| Mecanismo | Implementação |
|---|---|
| **Consentimento** | Campo `lgpdConsent` (Boolean) no formulário. Default `true` |
| **Base legal** | Dados de fontes públicas → interesse legítimo (Art. 7, IX) |
| **Revogação** | `POST /webhooks/revogar-lgpd` → anonimiza nome, email (hash), cargo, empresa, telefone, LinkedIn, dados de enriquecimento. Registra auditoria |
| **Armazenamento** | Supabase PostgreSQL com criptografia em repouso (AWS us-east-1), SSL via PgBouncer |
| **Minimização** | Apenas dados necessários para o funil |

---

## 5. Decisões Estratégicas

### Decisão 1: n8n como orquestrador externo (não `@nestjs/schedule`)

O agente precisa "acordar sozinho" dias depois da inscrição. Um `setInterval` no NestJS não tem logs auditáveis, é difícil de monitorar em produção e não escala com múltiplas instâncias. O n8n separa lógica de negócios (NestJS) de lógica temporal (Cron), com interface visual para debug e pontua no bônus "low-code/no-code".

Referência: padrão de "orquestrador externo" (Temporal, Airflow).

### Decisão 2: LangChain em vez do SDK nativo Anthropic

O SDK nativo `@anthropic-ai/sdk` exigiria implementação manual do loop de tool calling (receber `tool_use`, executar, devolver `tool_result`) e gerenciamento de histórico. O LangChain abstrai tudo com `bindTools` e `BaseMessage`, e permite trocar de modelo (Claude → Gemini) mudando uma variável de ambiente.

### Decisão 3: Enriquecimento com mock determinístico

Por questões de velocidade e praticidade (tratando-se de um case/teste/MVP), optou-se por um dicionário determinístico. Ele mantém o padrão de código real (serviço injetável, async) sem a fricção ou custo de APIs externas como Clearbit/Apollo.io.

### Decisão 4: Arquitetura híbrida (NestJS + n8n) — por que não tudo em um só lugar?

Manter um servidor para o NestJS e outro para o n8n é mais caro e complexo do que consolidar tudo. Adiciona um ponto de falha extra na rede. Essa decisão foi estratégica e intencional — para esta case, o objetivo foi demonstrar **duas capacidades distintas**:

1. **Motor Cognitivo com código** (NestJS + Prisma + LangChain): tipagem, Swagger, injeção de dependência, testes, controle de versão.
2. **Geração de valor rápida com low-code** (n8n): webhook em 2 cliques, CronJob visual, bridge Telegram sem boilerplate.

**Na vida real, a escolha depende do momento da empresa:**

| Cenário | Quando usar | Trade-offs |
|---|---|---|
| **100% Low-Code** (tudo no n8n/Make) | MVP urgente, validação rápida, equipe não-técnica precisa alterar a régua sem engenharia | Estado complexo (memória do agente) é difícil, Git precário, testes automatizados complexos, risco de "espaguete visual" |
| **100% Código** (tudo no NestJS) | Escalabilidade massiva, regras de negócio complexas, CI/CD rígido, compliance severo (LGPD). **Caminho natural para uma empresa de cibersegurança como a Vigil.AI** | Tempo de desenvolvimento alto — webhook ou CronJob do zero leva horas; no n8n leva minutos |
| **Híbrido Orquestrado** (o que foi entregue) | Demonstrar versatilidade técnica: n8n como "braços e pernas" (formulário, cron, Telegram) e NestJS como "cérebro" (LLM, tools, banco auditável) | Custo de infra maior, ponto de falha extra na rede |

**Resumo:** código (NestJS) onde a regra de negócio é densa e exige persistência confiável. Low-code (n8n) onde o trabalho é commodity (receber formulário, disparar cron). Para escalar com segurança — que é a cara da Vigil.AI — o caminho seria consolidar 100% em código proprietário.

---

## 6. Plano de Execução

| Dia | Foco | Entregas |
|---|---|---|
| **1** | Infra + Banco | Supabase, schema Prisma (Event, Lead, Interaction), `prisma db push`, evento de teste |
| **2** | Motor Cognitivo | `AgentService` com LangChain + Claude, tool calling (`agendar_reuniao`), `WebhooksController` |
| **3** | Enriquecimento + Régua | `EnrichmentService` (9 empresas + fallback), `gerarMensagemProativa()` (D-3/D-1/D+1) |
| **4** | Orquestração n8n | 3 workflows (formulário, Cron régua, bridge Telegram), testes ponta a ponta |
| **5** | Docs + LGPD + Polish | README, Swagger/OpenAPI, `revogar-lgpd`, personas de teste, revisão |

A ordem prioriza dependências: sem banco nada funciona → sem LLM não há agente → sem enriquecimento as mensagens são genéricas → n8n conecta tudo → documentação fecha o ciclo.

---

## Cenário de Escala (Bônus)

A Vigil.AI quer replicar o modelo para 10 eventos regionais simultâneos (manufatura, saúde, financeiro, governo).

**A arquitetura já suporta isso sem reescrever o agente:**

1. **Isolamento por `eventId`:** todo lead pertence a um evento. Todas as queries filtram por `eventId`.
2. **Régua independente:** `POST /webhooks/campanha` recebe `eventId` + `faseRegua`. O n8n teria 10 Cron nodes (ou 1 com loop), cada um com sua `dataEvento`.
3. **Personalização por setor:** prompts do Claude usam `lead.setor` e `lead.cargo`. Um lead do setor Saúde recebe menção a LGPD e ransomware; Financeiro recebe BACEN e ISO 27001.
4. **Zero mudanças no código:** `AgentService` e `EnrichmentService` são stateless em relação a eventos. Adicionar 10 eventos = 10 `INSERT INTO Event` + 10 Cron workflows no n8n.

**Para produção real, faltaria:** cache de prompts (Redis), fila de processamento (BullMQ), rate limiting na API Anthropic, monitoramento segregado por evento.

---

## 3 Workflows do n8n

### Workflow 1 — Formulário de Captação

```
[Formulário n8n Cloud] → [Webhook Trigger] → [HTTP Request: POST /webhooks/leads] → [Resposta com link Telegram]
```

- **Trigger:** Submissão do formulário público (nome, email, cargo, empresa)
- **Ação:** Envia os dados para `POST /webhooks/leads` do NestJS
- **Resultado:** Lead criado com status `CAPTADO`, enriquecimento disparado em background
- **URL pública:** https://andre-kortkamp.app.n8n.cloud/form/11b01538-6848-482c-9a1d-d810cf512465

### Workflow 2 — Bridge Telegram ↔ NestJS (Chat Reativo)

```
[Telegram Trigger] → [Extrair leadId/chatId + mensagem] → [HTTP Request: POST /webhooks/n8n] → [Telegram: Enviar resposta]
```

- **Trigger:** Mensagem recebida no Telegram Bot (`@VigilSummitBot`)
- **Ação:** Extrai o `telegramChatId` e a mensagem, encaminha para `POST /webhooks/n8n`
- **Resultado:** O NestJS invoca o Claude com contexto enriquecido + histórico, retorna resposta → n8n envia de volta ao Telegram

### Workflow 3 — Cron da Régua Proativa (D-3, D-1, D+1)

```
[Cron: Diário 09:00] → [Supabase: Query leads elegíveis] → [Loop por lead] → [HTTP Request: POST /webhooks/campanha] → [Telegram: Enviar mensagem]
```

- **Trigger:** Cron diário às 09:00 (UTC-3)
- **Ação:**
  1. Consulta Supabase: busca eventos cuja `dataEvento` está a 3 dias, 1 dia ou ocorreu há 1 dia
  2. Filtra leads nos status elegíveis (`ENRIQUECIDO` para D-3, `ENGAGED_PRE` para D-1, `CONFIRMADO`/`PRESENTE` para D+1)
  3. Para cada lead, chama `POST /webhooks/campanha` com `eventId`, `leadId`, `faseRegua`
  4. Envia a mensagem gerada pelo Claude ao Telegram do lead
- **Resultado:** Régua proativa executa automaticamente sem intervenção manual

---

## API — Endpoints

Documentação interativa completa em [https://vigil-ai-agent.onrender.com/api/docs](https://vigil-ai-agent.onrender.com/api/docs) (Swagger/OpenAPI).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/webhooks/leads` | Captação de lead (Fase 1) |
| `POST` | `/webhooks/enriquecer` | Enriquecimento manual (Fase 2) |
| `POST` | `/webhooks/n8n` | Chat reativo (Telegram → NestJS → Claude → Telegram) |
| `POST` | `/webhooks/campanha` | Régua proativa (D-3, D-1, D+1) |
| `POST` | `/webhooks/revogar-lgpd` | Revogação LGPD (anonimização) |
| `POST` | `/events` | Criar evento |

### Swagger/OpenAPI

O Swagger UI está disponível em `/api/docs` com:
- Descrição detalhada de cada endpoint (fluxo interno, regras de negócio)
- Exemplos de request/response para todos os DTOs
- Tags organizadas: `Webhooks`, `Eventos`, `Health`
- Plugin `@nestjs/swagger` com introspecção automática via `nest-cli.json`

---

## Modelo de Dados

```
Event (id, nome, publicoAlvo, dataEvento)
  │
  └── Lead (id, eventId, nome, email, cargo, empresa, setor, tamanhoEmpresa,
  │         dadosBrutosEnriquecimento, status, lgpdConsent, trazAcompanhante)
  │
  └── Interaction (id, leadId, tipo, origem, conteudo, metadata)
```

**Enums:**
- `FunnelStatus`: CAPTADO → ENRIQUECIDO → ENGAGED_PRE → CONFIRMADO → PRESENTE → ENGAGED_POS → REUNIAO_AGENDADA | NO_SHOW
- `InteractionType`: MENSAGEM_RECEBIDA | MENSAGEM_ENVIADA | COMPORTAMENTO_EVENTO | MUDANCA_STATUS

---

## Agente — Ferramentas (Tool Calling)

O agente tem 4 ferramentas que pode acionar de forma autônoma durante a conversa:

| Ferramenta | Quando o agente usa | Efeito |
|---|---|---|
| `agendar_reuniao` | Lead concorda explicitamente em agendar | Status → `REUNIAO_AGENDADA` |
| `confirmar_presenca` | Lead diz que vai comparecer ao evento | Status → `CONFIRMADO` |
| `consultar_perfil_lead` | Agente precisa de dados para personalizar | Retorna perfil completo do banco |
| `registrar_interesse_evento` | Lead menciona interesse em tema específico | Registra `Interaction` de comportamento |

O agente usa Chain-of-Thought (raciocínio estruturado) antes de cada resposta: avalia a fase do funil, o objetivo imediato, os dados disponíveis e se alguma ferramenta deve ser acionada.

---

## Estrutura do Projeto

```
backend/
  prisma/
    schema.prisma              # Modelo de dados (3 tabelas, 2 enums)
  src/
    main.ts                    # Bootstrap NestJS + Swagger config
    app.module.ts              # Módulo raiz
    app.controller.ts          # Health check (/api/docs: Health tag)
    prisma/
      prisma.service.ts        # Cliente Prisma
      prisma.module.ts         # Módulo global
    modules/
      agent/
        agent.service.ts       # Claude + LangChain + 4 tools + CoT
        agent.module.ts
      webhooks/
        webhooks.controller.ts # 6 endpoints REST (Swagger documentado)
        webhooks.module.ts
        dto/                   # DTOs com @ApiProperty
      enrichment/
        enrichment.service.ts  # Mock determinístico (9 empresas + fallback)
        enrichment.module.ts
      events/
        events.controller.ts   # CRUD de eventos
        events.module.ts
        dto/

frontend/                        # Dashboard Next.js 16
  proxy.ts                       # Proteção de rotas (auth via cookie)
  app/
    layout.tsx                   # Root layout (Geist font, metadata PT-BR)
    page.tsx                     # Dashboard principal (SSR, Suspense)
    login/page.tsx               # Tela de login protegida por senha
    actions/
      auth.ts                    # Server Action: login com cookie httpOnly
      agente.ts                  # Server Action: disparo manual de régua
  components/
    cards-resumo.tsx             # 4 cards do funil + 2 métricas
    tabela-leads.tsx             # Tabela de leads com badge de status
    painel-lead.tsx              # Detalhes + timeline de interações
    seletor-evento.tsx           # Filtro multi-tenant por evento
    botao-forcar-disparo.tsx     # Disparo manual D-3/D-1/D+1
  lib/prisma.ts                  # Prisma Client com adapter PG + SSL
  prisma/schema.prisma           # Schema espelhado do backend
```

---

## Como Rodar Local

### Backend (API + Agente)

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
# API disponível em http://localhost:3000
# Swagger em http://localhost:3000/api/docs
```

### Frontend (Dashboard)

```bash
cd frontend
npm install
npx prisma generate
npm run dev
# Dashboard disponível em http://localhost:3001
# Senha padrão: vigil2026
```

### Variáveis de ambiente

**`backend/.env`**

```env
DATABASE_URL="postgresql://..."      # Supabase pooler (PgBouncer)
DIRECT_URL="postgresql://..."        # Supabase direto (para migrations)
LLM_PROVIDER=anthropic               # ou 'gemini'
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...                   # (opcional, só se LLM_PROVIDER=gemini)
```

**`frontend/.env`**

```env
DATABASE_URL="postgresql://..."      # Mesma conexão Supabase (read-only)
ADMIN_PASSWORD="vigil2026"           # Senha de acesso ao dashboard
NEXT_PUBLIC_API_URL="http://localhost:3000"  # URL da API backend
```

---

## Dashboard — Painel de Monitoramento (Bônus)

Interface web em **Next.js 16** com acesso protegido por senha, conectada diretamente ao banco Supabase via Prisma.

### Funcionalidades

- **Visão do funil em tempo real:** 4 cards — Total Captados, Confirmados, Presentes, Reuniões Agendadas
- **Métricas calculadas:** Taxa de No-Show e Taxa de Conversão (captado → reunião)
- **Tabela de leads:** nome, empresa, cargo e status com badges coloridos por fase
- **Detalhes do lead:** painel lateral com perfil completo (empresa, setor, porte, LGPD) e timeline de todas as interações com o agente
- **Filtro por evento:** seletor multi-tenant para visualizar leads de eventos específicos
- **Disparo manual da régua:** botões D-3, D-1 e D+1 para forçar envio de mensagem a um lead específico via API
- **Proteção por senha:** proxy de autenticação (Next.js 16 `proxy.ts`) com cookie httpOnly. Redirect automático para `/login` se não autenticado

### Stack do frontend

| Tecnologia | Papel |
|---|---|
| Next.js 16 (App Router) | SSR com `force-dynamic`, Server Actions, Suspense |
| Prisma + `@prisma/adapter-pg` | Leitura direta do banco Supabase (mesmo schema do backend) |
| Tailwind CSS v4 | Estilização |
| `proxy.ts` | Auth guard via cookie (padrão Next.js 16, substitui `middleware.ts`) |

---

## Acesso para Teste

| Recurso | Acesso | Credenciais |
|---|---|---|
| **Dashboard** | [vigil-ai-agent.vercel.app](https://vigil-ai-agent.vercel.app/) | Senha: `vigil2026` |
| **Supabase** | Convite enviado para `ramon@pareto.io` |
| **n8n Cloud** | Convite enviado para `ramon@pareto.io` | Visualização dos 3 workflows |
| **Formulário** | [Inscrição pública](https://andre-kortkamp.app.n8n.cloud/form/11b01538-6848-482c-9a1d-d810cf512465) |
| **Telegram Bot** | [@VigilSummitBot](https://t.me/VigilSummitBot) |
| **Swagger/API** | [vigil-ai-agent.onrender.com/api/docs](https://vigil-ai-agent.onrender.com/api/docs) |



Dúvidas: entre em contato pelo repositório ou diretamente.
