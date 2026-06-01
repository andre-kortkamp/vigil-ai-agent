import { prisma } from "@/lib/prisma";
import BotaoForcarDisparo from "@/components/botao-forcar-disparo";

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

const TIPO_INTERACAO_LABELS: Record<string, string> = {
  MENSAGEM_RECEBIDA: "Lead enviou",
  MENSAGEM_ENVIADA: "Agente respondeu",
  COMPORTAMENTO_EVENTO: "Comportamento no evento",
  MUDANCA_STATUS: "Mudança de status",
};

type Props = {
  leadId: string;
};

export default async function PainelLead({ leadId }: Props) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      interactions: {
        orderBy: { createdAt: "asc" },
      },
      event: true,
    },
  });

  if (!lead) {
    return (
      <div className="rounded-xl bg-white p-8 shadow-md text-center">
        <p className="text-gray-500">Lead não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{lead.nome}</h3>
          <p className="text-sm text-gray-500">{lead.email}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            STATUS_CORES[lead.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 p-5">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Perfil do Lead
        </h4>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-400">Empresa</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.empresa || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">Cargo</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.cargo || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">Setor</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.setor || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">
              Tamanho da Empresa
            </dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.tamanhoEmpresa || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">Telefone</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.telefone || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">LinkedIn</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.linkedinUrl ? (
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Perfil
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">Acompanhante</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.trazAcompanhante ? "Sim" : "Não"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">
              Consentimento LGPD
            </dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.lgpdConsent ? "Sim" : "Não"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">Evento</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lead.event?.nome || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">
              Cadastrado em
            </dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Timeline de Interações
        </h4>
        {lead.interactions.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-400">
              Nenhuma interação registrada com este lead.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            {lead.interactions.map((interaction) => (
              <div key={interaction.id} className="relative flex gap-4 py-3 pl-10">
                <div
                  className={`absolute left-2.5 h-3 w-3 rounded-full border-2 border-white ${
                    interaction.tipo === "MENSAGEM_ENVIADA"
                      ? "bg-indigo-500"
                      : interaction.tipo === "MENSAGEM_RECEBIDA"
                        ? "bg-emerald-500"
                        : interaction.tipo === "MUDANCA_STATUS"
                          ? "bg-amber-500"
                          : "bg-gray-400"
                  }`}
                />
                <div className="min-w-0 flex-1 rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {TIPO_INTERACAO_LABELS[interaction.tipo] ||
                        interaction.tipo}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(interaction.createdAt).toLocaleDateString(
                        "pt-BR",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                    {interaction.conteudo}
                  </p>
                  <span className="mt-1 inline-block text-xs text-gray-400">
                    via {interaction.origem}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BotaoForcarDisparo leadId={lead.id} eventId={lead.eventId} />
    </div>
  );
}
