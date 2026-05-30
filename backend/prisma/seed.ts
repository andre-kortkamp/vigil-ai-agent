import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SEED_EVENT_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
  const prisma = new PrismaClient({ adapter });

  try {
    const dataEvento = new Date();
    dataEvento.setDate(dataEvento.getDate() + 7);

    const evento = await prisma.event.upsert({
      where: { id: SEED_EVENT_ID },
      update: {
        nome: "Vigil Summit - Segurança para a Era da IA",
        publicoAlvo: "CISOs e CTOs",
        dataEvento,
      },
      create: {
        id: SEED_EVENT_ID,
        nome: "Vigil Summit - Segurança para a Era da IA",
        publicoAlvo: "CISOs e CTOs",
        dataEvento,
      },
    });

    console.log("Seed executado com sucesso!");
    console.log(`Evento criado: ${evento.nome} (ID: ${evento.id})`);
    console.log(`Data do evento: ${evento.dataEvento?.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Erro no seed:", e);
  process.exit(1);
});
