import { env } from "cloudflare:workers";
import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { AdminWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const adminEmail = (env as unknown as { COMCHEQ_ADMIN_EMAIL?: string }).COMCHEQ_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || user.email.trim().toLowerCase() !== adminEmail) {
    return <main className="grid min-h-screen place-items-center bg-[#f7efe6] p-6 text-[#332118]"><section className="w-full max-w-lg rounded-3xl border border-[#decdbd] bg-[#fffdf9] p-7 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#967663]">Coffee Payroll support workspace</p><h1 className="mt-2 text-2xl font-semibold">Support access required</h1><p className="mt-3 text-sm leading-6 text-[#795f4f]">This area is restricted to authorized Coffee Payroll support staff.</p><a href={chatGPTSignOutPath("/admin")} target="_top" className="mt-5 inline-flex rounded-lg border border-[#d8c8ba] px-4 py-2 text-sm font-medium text-[#1557d8]">Sign out</a></section></main>;
  }
  return <AdminWorkspace actorEmail={user.email} signOutPath={chatGPTSignOutPath("/")} />;
}
