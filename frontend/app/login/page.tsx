import { login } from "@/app/actions/auth";

type Props = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function PaginaLogin({ searchParams }: Props) {
  const params = await searchParams;
  const erro = params.erro === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-pink-100 to-orange-100">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Vigil.AI</h1>
          <p className="mt-1 text-sm text-gray-500">Dashboard Vigil Summit</p>
        </div>

        <form action={login} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Senha de Acesso
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Digite a senha"
            />
          </div>
          {erro && (
            <p className="text-sm text-red-600 text-center font-medium">
              Senha incorreta. Tente novamente.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
