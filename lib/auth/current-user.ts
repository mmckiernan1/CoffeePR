import "server-only";

import { cookies } from "next/headers";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/auth/supabase-rest";

export type CoffeePayrollUser = {
  id: string;
  email: string;
};

export async function getCoffeePayrollUser(): Promise<CoffeePayrollUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const user = await verifyAccessToken(accessToken);
  if (!user?.id || !user.email) return null;

  return { id: user.id, email: user.email.toLowerCase() };
}
