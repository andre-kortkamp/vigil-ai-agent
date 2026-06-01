import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  CAPTADO: "Captado",
  ENRIQUECIDO: "Enriquecido",
  ENGAGED_PRE: "Engajado (Pré)",
  CONFIRMADO: "Confirmado",
  PRESENTE: "Presente",
  ENGAGED_POS: "Engajado (Pós)",
  REUNIAO_AGENDADA: "Reunião Agendada",
  NO_SHOW: "No-Show",
};

const STATUS_CORES: Record<string, string> = {
  CAPTADO: "bg-gray-100 text-gray-700",
  ENRIQUECIDO: "bg-blue-100 text-blue-700",
  ENGAGED_PRE: "bg-purple-100 text-purple-700",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  PRESENTE: "bg-amber-100 text-amber-700",
  ENGAGED_POS: "bg-indigo-100 text-indigo-700",
  REUNIAO_AGENDADA: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

type Props = {
  eventId?: string;
  leadIdAtivo?: string;
};

export default async function TabelaLeads({ eventId, leadIdAtivo }: Props) {
  const where = eventId ? { eventId } : {};

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (leads.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center shadow-md">
        <svg
          className="mx-auto h-12 w-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-semibold text-gray-900">
          Nenhum lead encontrado
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Os leads captados aparecerão aqui.
        </p>
      </div>
    );
  }

  const montarUrl = (leadId: string): string => {
    const params = new URLSearchParams();
    params.set("leadId", leadId);
    if (eventId) params.set("eventId", eventId);
    return `/?${params.toString()}`;
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cargo
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => {
              const ativo = lead.id === leadIdAtivo;
              return (
                <tr
                  key={lead.id}
                  className={`cursor-pointer transition-colors hover:bg-indigo-50 ${
                    ativo ? "bg-indigo-50 ring-1 ring-indigo-200" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    <a
                      href={montarUrl(lead.id)}
                      className="block hover:text-indigo-600"
                    >
                      {lead.nome}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    <a
                      href={montarUrl(lead.id)}
                      className="block hover:text-indigo-600"
                    >
                      {lead.empresa || "—"}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    <a
                      href={montarUrl(lead.id)}
                      className="block hover:text-indigo-600"
                    >
                      {lead.cargo || "—"}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <a href={montarUrl(lead.id)} className="block">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CORES[lead.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
