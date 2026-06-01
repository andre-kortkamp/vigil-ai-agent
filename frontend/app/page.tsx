import { Suspense } from "react";
import Link from "next/link";
import CardsResumo from "@/components/cards-resumo";
import TabelaLeads from "@/components/tabela-leads";
import SeletorEvento from "@/components/seletor-evento";
import PainelLead from "@/components/painel-lead";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function CardsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-white p-5 shadow-md"
          >
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
            <div className="mt-4 h-1 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-white p-5 shadow-md"
          >
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="mt-3 h-6 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TabelaSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-6 shadow-md">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-3 h-10 w-full rounded bg-gray-100" />
      ))}
    </div>
  );
}

type Props = {
  searchParams: Promise<{ leadId?: string; eventId?: string }>;
};

export default async function PaginaDashboard({ searchParams }: Props) {
  const params = await searchParams;
  const leadIdAtivo = params.leadId;
  const eventId = params.eventId;

  const eventos = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true },
  });

  return (
    <main className="bg-gradient-to-br from-indigo-100 via-pink-100 to-orange-100 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Vigil Summit — Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Acompanhamento do funil de leads em tempo real
              </p>
            </div>
            <a
              href="https://andrekortkamp.app.n8n.cloud/form/37e89384-2085-4e7f-9116-e9af614a6927"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-emerald-400 hover:to-emerald-500 transition-all sm:self-end"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              + Captar Lead (n8n)
            </a>
          </div>
          <SeletorEvento eventos={eventos} eventIdAtual={eventId} />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div
            className={`flex-1 space-y-6 transition-all ${
              leadIdAtivo ? "lg:pr-4" : ""
            }`}
          >
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Visão Geral do Funil
              </h2>
              <Suspense fallback={<CardsSkeleton />}>
                <CardsResumo eventId={eventId} />
              </Suspense>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Lista de Leads
              </h2>
              <Suspense fallback={<TabelaSkeleton />}>
                <TabelaLeads eventId={eventId} leadIdAtivo={leadIdAtivo} />
              </Suspense>
            </section>
          </div>

          {leadIdAtivo && (
            <div className="w-full lg:w-96 shrink-0">
              <div className="sticky top-8 rounded-xl bg-white p-6 shadow-lg border border-gray-100 max-h-[calc(100vh-4rem)] overflow-y-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Detalhes do Lead
                  </h2>
                  <Link
                    href={eventId ? `/?eventId=${eventId}` : "/"}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                </div>
                <Suspense
                  fallback={
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 w-32 rounded bg-gray-200" />
                      <div className="h-4 w-48 rounded bg-gray-200" />
                      <div className="h-40 rounded bg-gray-100" />
                    </div>
                  }
                >
                  <PainelLead leadId={leadIdAtivo} />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
