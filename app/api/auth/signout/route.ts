import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/supabase-rest";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true });
}
