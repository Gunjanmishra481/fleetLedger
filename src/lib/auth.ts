// Single admin login from .env (MVP). Session = signed cookie, verified with Web Crypto so the
// same code runs in middleware (edge) and in server actions (node).

export const SESSION_COOKIE = "fl_session";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Set ADMIN_PASSWORD (and optionally AUTH_SECRET) in .env");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** Compares via HMAC digests so the comparison time doesn't depend on where strings differ. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([hmac(`cmp|${a}`), hmac(`cmp|${b}`)]);
  let diff = ha.length ^ hb.length;
  for (let i = 0; i < Math.min(ha.length, hb.length); i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(user: string, password: string): Promise<boolean> {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  const [okU, okP] = await Promise.all([safeEqual(user, u), safeEqual(password, p)]);
  return okU && okP;
}

export async function createSessionToken(user: string): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE_S * 1000;
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp })));
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the user name for a valid, unexpired token, else null. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!(await safeEqual(sig, await hmac(payload)))) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { u, exp } = JSON.parse(json) as { u: string; exp: number };
    return typeof u === "string" && typeof exp === "number" && exp > Date.now() ? u : null;
  } catch {
    return null;
  }
}
