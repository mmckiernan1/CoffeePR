import "server-only";

import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
  refreshSupabaseSession,
  verifyAccessToken,
} from "@/lib/auth/supabase-rest";

export type CoffeePayrollUser = {
  id: string;
  email: string;
};

export async function getCoffeePayrollUser(): Promise<CoffeePayrollUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const user = await verifyAccessToken(accessToken);
    if (user?.id && user.email) {
      return { id: user.id, email: user.email.toLowerCase() };
    }
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const refreshed = await refreshSupabaseSession(refreshToken);
  if (!refreshed?.access_token) {
    cookieStore.delete(ACCESS_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    return null;
  }

  const user = await verifyAccessToken(refreshed.access_token);
  if (!user?.id || !user.email) {
    cookieStore.delete(ACCESS_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    return null;
  }

  cookieStore.set(
    ACCESS_COOKIE,
    refreshed.access_token,
    authCookieOptions(refreshed.expires_in ?? 3600),
  );
  if (refreshed.refresh_token) {
    cookieStore.set(
      REFRESH_COOKIE,
      refreshed.refresh_token,
      authCookieOptions(60 * 60 * 24 * 30),
    );
  }

  return { id: user.id, email: user.email.toLowerCase() };
}
