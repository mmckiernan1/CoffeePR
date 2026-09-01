import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function getComcheqAdmin() {
  const user = await getChatGPTUser();
  const adminEmail = (env as unknown as { COMCHEQ_ADMIN_EMAIL?: string }).COMCHEQ_ADMIN_EMAIL?.trim().toLowerCase();
  if (!user || !adminEmail || user.email.trim().toLowerCase() !== adminEmail) return null;
  return user;
}

export type ComcheqRole = "Administrator" | "Payroll Processor" | "Read-only";

export async function getComcheqActor(): Promise<{ email: string; displayName: string; role: ComcheqRole } | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const normalizedEmail = user.email.trim().toLowerCase();
  const adminEmail = (env as unknown as { COMCHEQ_ADMIN_EMAIL?: string }).COMCHEQ_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && normalizedEmail === adminEmail) return { email: user.email, displayName: user.displayName, role: "Administrator" };
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return null;
  const membership = await db.prepare("SELECT role FROM employer_memberships WHERE workspace_id = ? AND lower(email) = ? AND status = ? LIMIT 1").bind("WS-PNS-001", normalizedEmail, "Active").first<{ role: ComcheqRole }>();
  return membership ? { email: user.email, displayName: user.displayName, role: membership.role } : null;
}
