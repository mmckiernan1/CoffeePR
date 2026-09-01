import { buildDemoRbcCpa005File } from "@/lib/payroll/demo";

export async function GET() {
  const file = buildDemoRbcCpa005File(17, [2140.81, 1936.77, 2767.33, 1648.00]);
  return new Response(file.content, {
    headers: {
      "content-type": "text/plain; charset=us-ascii",
      "content-disposition": 'attachment; filename="comcheq-rbc-cpa005-test-pay-run-17.txt"',
      "x-comcheq-file-mode": "TEST",
      "x-comcheq-payment-count": String(file.control.paymentCount),
      "x-comcheq-control-total-cents": String(file.control.totalAmountCents),
    },
  });
}
