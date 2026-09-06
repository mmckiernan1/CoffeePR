import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/auth/supabase-rest";

const providers: Record<string, "google" | "azure" | "apple"> = {
  google: "google",
  microsoft: "azure",
  apple: "apple",
};

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await context.params;
  const provider = providers[providerName];
  if (!provider) return NextResponse.redirect(new URL("/login?error=provider", request.url));

  const { url } = getSupabaseConfig();
  const origin = new URL(request.url).origin;
  const callback = `${origin}/auth/callback`;
  const authorize = new URL(`${url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", provider);
  authorize.searchParams.set("redirect_to", callback);
  if (provider === "azure") authorize.searchParams.set("scopes", "email");

  return NextResponse.redirect(authorize);
}
