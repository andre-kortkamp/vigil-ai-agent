import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ROTAS_PROTEGIDAS = ["/"];
const ROTAS_PUBLICAS = ["/login"];

export default async function proxy(req: NextRequest) {
  const caminho = req.nextUrl.pathname;

  const rotaProtegida = ROTAS_PROTEGIDAS.some(
    (rota) => caminho === rota || (rota !== "/" && caminho.startsWith(rota))
  );
  const rotaPublica = ROTAS_PUBLICAS.includes(caminho);

  if (!rotaProtegida && !rotaPublica) {
    return NextResponse.next();
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth_token")?.value;

  const autenticado = authCookie === "vigil-autenticado";

  if (rotaProtegida && !autenticado) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (rotaPublica && autenticado && caminho === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
