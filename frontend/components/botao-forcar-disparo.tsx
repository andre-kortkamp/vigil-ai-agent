"use client";

import { useState } from "react";
import { forcarDisparo } from "@/app/actions/agente";

type Props = {
  leadId: string;
  eventId: string;
};

type FaseRegua = "D-3" | "D-1" | "D+1";

const FASES: { fase: FaseRegua; rotulo: string; cor: string }[] = [
  {
    fase: "D-3",
    rotulo: "D-3 — Antecipação",
    cor: "bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500",
  },
  {
    fase: "D-1",
    rotulo: "D-1 — Confirmação",
    cor: "bg-amber-600 hover:bg-amber-500 focus:ring-amber-500",
  },
  {
    fase: "D+1",
    rotulo: "D+1 — Follow-up",
    cor: "bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500",
  },
];

export default function BotaoForcarDisparo({ leadId, eventId }: Props) {
  const [carregando, setCarregando] = useState<FaseRegua | null>(null);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);

  async function disparar(fase: FaseRegua) {
    setCarregando(fase);
    setResultado(null);
    const res = await forcarDisparo(eventId, leadId, fase);
    setResultado(res);
    setCarregando(null);
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Forçar Régua
      </p>
      <div className="flex flex-col gap-2">
        {FASES.map(({ fase, rotulo, cor }) => (
          <button
            key={fase}
            onClick={() => disparar(fase)}
            disabled={carregando !== null}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cor}`}
          >
            {carregando === fase ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Enviando...
              </span>
            ) : (
              rotulo
            )}
          </button>
        ))}
      </div>

      {resultado && (
        <div
          className={`rounded-lg p-3 text-sm font-medium ${
            resultado.sucesso
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {resultado.mensagem}
        </div>
      )}
    </div>
  );
}
