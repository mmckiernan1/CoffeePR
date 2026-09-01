import { openApiDocument } from "@/lib/payroll/api-contract";

export async function GET() {
  return Response.json(openApiDocument, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
