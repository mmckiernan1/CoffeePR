/** Cloudflare Worker entry point for Coffee Payroll. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  COFFEE_PAYROLL_UAT_ONLY?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // The isolated mobile preview has no D1 binding. Keep every application
    // and API route outside the fictional, device-local payroll journey closed.
    if (env.COFFEE_PAYROLL_UAT_ONLY === "true") {
      const path = url.pathname;
      if (path === "/") return Response.redirect(new URL("/uat/fictional", url), 302);
      if (path === "/api/pilot/workspace" || path === "/api/pilot/payments") {
        return Response.json({ code: "UAT_DEVICE_ONLY", error: "This fictional preview stores progress on this device." }, { status: 404 });
      }
      const allowed = path === "/uat/fictional" || path === "/guided-payroll" ||
        path === "/uat" || path.startsWith("/uat/") ||
        path.startsWith("/_next/") || path.startsWith("/assets/") ||
        path === "/favicon.svg";
      if (!allowed) return new Response("Not found", { status: 404 });
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
