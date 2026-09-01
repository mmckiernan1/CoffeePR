import { RBC_CPA005_SPEC } from "@/lib/payroll/rbc-cpa005";

export async function GET() {
  return Response.json({
    product: "Comcheq Payroll",
    version: "0.6.0-operating-model",
    environment: "public-fictional-prototype",
    capabilities: {
      payRunStateMachine: "implemented-and-tested",
      integerMoney: "implemented-and-tested",
      alberta2026RegularPeriodic: "implemented-cra-worked-examples-reconciled",
      statutoryDemo: "/api/v1/demo/alberta-calculation",
      rbcBankAdapter: `${RBC_CPA005_SPEC.adapter}-test-mode`,
      paymentsCanadaAftSimulation: "fixed-record-generic-workflow-rehearsal",
      administratorCsvDataExchange: "interactive-validation-prototype",
      openApiContract: "/api/v1/openapi",
      persistentPayrollRecords: "authenticated-fictional-admin-milestone",
      appendOnlyAuditEvents: "implemented-for-admin-mutations",
      effectiveDatedEmploymentChanges: "durable-and-versioned",
      salaryRetroactivity: "integer-cents-workday-proration-tested",
      openingBalanceLedger: "durable-validated-records",
      linkedCorrectionRuns: "durable-approval-workflow",
      bankedOvertime: "agreement-gated-auditable-in-out-ledger",
      eftBankHandoff: "controlled-test-file-and-external-bank-link",
      craRemittanceWorkflow: "quarterly-monthly-accelerated-due-dates-reminders-and-payment-tracking",
      t4Xml: "production-gate",
      roeXml: "production-gate",
    },
  });
}
