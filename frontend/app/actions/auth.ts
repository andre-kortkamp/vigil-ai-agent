"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const senha = formData.get("password") as string;

  if (senha !== process.env.ADMIN_PASSWORD) {
    redirect("/login?erro=1");
  }

  const cookieStore = await cookies();

  cookieStore.set("auth_token", "vigil-autenticado", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  redirect("/");
}
