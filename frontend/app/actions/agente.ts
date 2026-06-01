"use server";

export async function forcarDisparo(
  eventId: string,
  leadId: string,
  faseRegua: "D-1" | "D-3" | "D+1",
) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const resposta = await fetch(`${apiUrl}/webhooks/campanha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, leadId, faseRegua }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    return { sucesso: false, mensagem: `Erro da API: ${erro}` };
  }

  const dados = await resposta.json();
  return {
    sucesso: true,
    mensagem: dados.mensagem ?? `Disparo ${faseRegua} enviado com sucesso.`,
  };
}
