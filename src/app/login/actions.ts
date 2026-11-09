"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  checkCredentials,
  createSessionToken,
} from "@/lib/auth";

const loginSchema = z.object({
  user: z.string().trim().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const next = safeNext(parsed.success ? parsed.data.next : undefined);
  if (!parsed.success || !(await checkCredentials(parsed.data.user, parsed.data.password))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(parsed.data.user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
