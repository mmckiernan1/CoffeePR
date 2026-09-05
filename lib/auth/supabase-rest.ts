import "server-only";

export const ACCESS_COOKIE = "coffee_payroll_access";
export const REFRESH_COOKIE = "coffee_payroll_refresh";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Coffee Payroll authentication is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function supabaseAuthRequest(path: string, init: RequestInit = {}) {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Content-Type", "application/json");

  return fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function verifyAccessToken(accessToken: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json() as Promise<{ id: string; email?: string }>;
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
