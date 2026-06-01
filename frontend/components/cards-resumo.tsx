import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  eventId?: string;
};

export default async function CardsResumo({ eventId }: Props) {
  const where = eventId ? { eventId } : {};

  const [totalCaptados, confirmados, presentes, reunioesAgendadas, noShow] =
    await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: "CONFIRMADO" } }),
      prisma.lead.count({ where: { ...where, status: "PRESENTE" } }),
      prisma.lead.count({ where: { ...where, status: "REUNIAO_AGENDADA" } }),
      prisma.lead.count({ where: { ...where, status: "NO_SHOW" } }),
    ]);

  const taxaNoShow =
    totalCaptados > 0 ? ((noShow / totalCaptados) * 100).toFixed(1) : "0.0";
  const taxaConversao =
    totalCaptados > 0
      ? ((reunioesAgendadas / totalCaptados) * 100).toFixed(1)
      : "0.0";

  const cards = [
    {
      titulo: "Total Captados",
      valor: totalCaptados,
      cor: "from-indigo-500 to-indigo-600",
      icone: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      titulo: "Confirmados",
      valor: confirmados,
      cor: "from-emerald-500 to-emerald-600",
      icone: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      titulo: "Presentes",
      valor: presentes,
      cor: "from-amber-500 to-amber-600",
      icone: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      titulo: "Reuniões Agendadas",
      valor: reunioesAgendadas,
      cor: "from-rose-500 to-rose-600",
      icone: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
        </svg>
      ),
    },
  ];

  const metricas = [
    {
      titulo: "Taxa de No-Show",
      valor: `${taxaNoShow}%`,
      cor: "from-red-500 to-red-600",
      info: `${noShow} leads não compareceram`,
    },
    {
      titulo: "Taxa de Conversão",
      valor: `${taxaConversao}%`,
      cor: "from-green-500 to-green-600",
      info: `Captado → Reunião Agendada`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.titulo}
            className="overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {card.titulo}
                </span>
                <span className="text-gray-400">{card.icone}</span>
              </div>
              <p
                className={`mt-3 text-3xl font-bold bg-gradient-to-r ${card.cor} bg-clip-text text-transparent`}
              >
                {card.valor}
              </p>
            </div>
            <div className={`h-1 bg-gradient-to-r ${card.cor}`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metricas.map((metrica) => (
          <div
            key={metrica.titulo}
            className="overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="p-5">
              <span className="text-sm font-medium text-gray-500">
                {metrica.titulo}
              </span>
              <p
                className={`mt-2 text-2xl font-bold bg-gradient-to-r ${metrica.cor} bg-clip-text text-transparent`}
              >
                {metrica.valor}
              </p>
              <p className="mt-1 text-xs text-gray-400">{metrica.info}</p>
            </div>
            <div className={`h-1 bg-gradient-to-r ${metrica.cor}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
