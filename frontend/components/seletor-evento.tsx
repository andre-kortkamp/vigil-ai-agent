"use client";

import { useRouter } from "next/navigation";

type Evento = {
  id: string;
  nome: string;
};

type Props = {
  eventos: Evento[];
  eventIdAtual?: string;
};

export default function SeletorEvento({ eventos, eventIdAtual }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const valor = e.target.value;
    const url = new URL(window.location.href);
    if (valor) {
      url.searchParams.set("eventId", valor);
    } else {
      url.searchParams.delete("eventId");
    }
    url.searchParams.delete("leadId");
    router.push(url.toString());
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="evento"
        className="text-sm font-medium text-gray-700 whitespace-nowrap"
      >
        Filtrar por Evento:
      </label>
      <select
        id="evento"
        name="eventId"
        defaultValue={eventIdAtual ?? ""}
        onChange={handleChange}
        className="block w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Todos os eventos</option>
        {eventos.map((evento) => (
          <option key={evento.id} value={evento.id}>
            {evento.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
