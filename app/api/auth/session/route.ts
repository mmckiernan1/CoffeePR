import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions, verifyAccessToken } from "@/lib/auth/supabase-rest";

type SessionBody = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SessionBody;
  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  const user = await verifyAccessToken(body.accessToken);
  if (!user) {
    return NextResponse.json({ error: "The sign-in session could not be verified." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, body.accessToken, authCookieOptions(body.expiresIn ?? 3600));
  if (body.refreshToken) {
    cookieStore.set(REFRESH_COOKIE, body.refreshToken, authCookieOptions(60 * 60 * 24 * 30));
  }

  return NextResponse.json({ ok: true, email: user.email ?? null });
}
