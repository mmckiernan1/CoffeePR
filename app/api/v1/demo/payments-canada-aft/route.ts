import { buildDemoPaymentsCanadaAftFile } from "@/lib/payroll/demo";

export async function GET() {
  const file = buildDemoPaymentsCanadaAftFile(17, [2_360.81, 1_936.77, 2_767.33, 1_428.02]);
  return new Response(file.content, {
    headers: {
      "content-type": "text/plain;charset=us-ascii",
      "content-disposition": 'attachment; filename="comcheq-payments-canada-aft-simulation-pay-run-17.txt"',
      "x-comcheq-file-mode": "SIMULATION",
      "x-comcheq-standard": "Payments-Canada-005",
      "x-comcheq-payment-count": String(file.control.paymentCount),
      "x-comcheq-control-total-cents": String(file.control.totalAmountCents),
      "cache-control": "no-store",
    },
  });
}
