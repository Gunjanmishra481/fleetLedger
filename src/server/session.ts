import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Signed-in user for server actions; middleware already guards pages, this guards action calls too. */
export async function requireUser(): Promise<string> {
  const user = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) throw new Error("Not signed in");
  return user;
}
