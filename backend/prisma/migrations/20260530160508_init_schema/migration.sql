-- CreateEnum
CREATE TYPE "FunnelStatus" AS ENUM ('CAPTADO', 'ENRIQUECIDO', 'ENGAGED_PRE', 'CONFIRMADO', 'PRESENTE', 'ENGAGED_POS', 'REUNIAO_AGENDADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('MENSAGEM_RECEBIDA', 'MENSAGEM_ENVIADA', 'COMPORTAMENTO_EVENTO', 'MUDANCA_STATUS');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "publicoAlvo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "linkedinUrl" TEXT,
    "cargo" TEXT,
    "empresa" TEXT,
    "tamanhoEmpresa" TEXT,
    "setor" TEXT,
    "dadosBrutosEnriquecimento" JSONB,
    "trazAcompanhante" BOOLEAN DEFAULT false,
    "status" "FunnelStatus" NOT NULL DEFAULT 'CAPTADO',
    "lgpdConsent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "InteractionType" NOT NULL,
    "origem" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
