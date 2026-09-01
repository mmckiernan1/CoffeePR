import { buildDemoAlbertaCalculation } from "@/lib/payroll/demo";

export async function GET() {
  return Response.json({
    environment: "public-fictional-prototype",
    warning: "Fictional read-only calculation evidence. Not a payroll advice service.",
    input: {
      employee: "Fictional Alberta employee",
      payDate: "2026-01-02",
      frequency: "weekly",
      cashEarningsCents: 130_000,
      registeredPlanDeductionCents: 8_000,
    },
    calculation: buildDemoAlbertaCalculation(),
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
