import { RBC_CPA005_SPEC } from "@/lib/payroll/rbc-cpa005";

export async function GET() {
  return Response.json({
    product: "Comcheq Payroll",
    version: "0.4.0-effective-dating",
    environment: "public-fictional-prototype",
    capabilities: {
      payRunStateMachine: "implemented-and-tested",
      integerMoney: "implemented-and-tested",
      alberta2026RegularPeriodic: "implemented-cra-worked-examples-reconciled",
      statutoryDemo: "/api/v1/demo/alberta-calculation",
      rbcBankAdapter: `${RBC_CPA005_SPEC.adapter}-test-mode`,
      administratorCsvDataExchange: "interactive-validation-prototype",
      openApiContract: "/api/v1/openapi",
      persistentPayrollRecords: "authenticated-fictional-admin-milestone",
      appendOnlyAuditEvents: "implemented-for-admin-mutations",
      effectiveDatedEmploymentChanges: "durable-and-versioned",
      salaryRetroactivity: "integer-cents-workday-proration-tested",
      openingBalanceLedger: "durable-validated-records",
      linkedCorrectionRuns: "durable-approval-workflow",
      t4Xml: "production-gate",
      roeXml: "production-gate",
    },
  });
}
