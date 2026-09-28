/** Cloudflare Worker entry point for Coffee Payroll. */
import handler from "vinext/server/app-router-entry";
import { isFictionalUatDeviceApi, isFictionalUatPathAllowed } from "../lib/fictional-uat-route-guard";

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
      if (isFictionalUatDeviceApi(path)) {
        return Response.json({ code: "UAT_DEVICE_ONLY", error: "This fictional preview stores progress on this device." }, { status: 404 });
      }
      if (!isFictionalUatPathAllowed(path)) return new Response("Not found", { status: 404 });
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
