import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions, supabaseAuthRequest } from "@/lib/auth/supabase-rest";

type PasswordBody = {
  mode?: "signin" | "signup";
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PasswordBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !email.includes("@") || password.length < 8) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
  }

  const mode = body.mode === "signup" ? "signup" : "signin";
  const path = mode === "signup" ? "/signup" : "/token?grant_type=password";
  const response = await supabaseAuthRequest(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({ error: payload?.msg ?? payload?.error_description ?? payload?.error ?? "Unable to sign in." }, { status: response.status });
  }

  // When email confirmation is enabled, signup can succeed without issuing a session yet.
  if (!payload.access_token) {
    return NextResponse.json({ ok: true, confirmationRequired: true });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, payload.access_token, authCookieOptions(payload.expires_in ?? 3600));
  if (payload.refresh_token) {
    cookieStore.set(REFRESH_COOKIE, payload.refresh_token, authCookieOptions(60 * 60 * 24 * 30));
  }

  return NextResponse.json({ ok: true, confirmationRequired: false });
}
