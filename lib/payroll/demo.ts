import { dollarsToCents, type MoneyCents } from "./money.ts";
import { generateRbcCpa005CreditFile, type RbcCpa005Payment } from "./rbc-cpa005.ts";
import { generatePaymentsCanadaAftSimulation } from "./payments-canada-aft.ts";
import { calculateAlbertaPayroll } from "./statutory/calculate.ts";

export const demoEmployees = [
  { employeeId: "EMP-0001", name: "Avery Chen", institutionNumber: "003", branchTransit: "00001", accountNumber: "1234567" },
  { employeeId: "EMP-0002", name: "Noah Williams", institutionNumber: "004", branchTransit: "00002", accountNumber: "2345678" },
  { employeeId: "EMP-0003", name: "Priya Singh", institutionNumber: "010", branchTransit: "00003", accountNumber: "3456789" },
  { employeeId: "EMP-0004", name: "Liam Martin", institutionNumber: "001", branchTransit: "00004", accountNumber: "4567890" },
] as const;

export function allocateDemoNetPay(targetTotalCents: MoneyCents, weights: readonly number[]): MoneyCents[] {
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return targetTotalCents - allocated;
    const share = Math.floor((targetTotalCents * weight) / weightTotal);
    allocated += share;
    return share;
  });
}

export function buildDemoRbcCpa005File(runNumber: number, netPayDollars: readonly number[]) {
  if (netPayDollars.length !== demoEmployees.length) throw new Error("Demo net pay must include all four fictional employees.");
  const payments: RbcCpa005Payment[] = demoEmployees.map((employee, index) => ({
    ...employee,
    amountCents: dollarsToCents(netPayDollars[index]),
    paymentDate: "2026-09-04",
    transactionCode: "200",
    customerNumber: employee.employeeId,
    sundryInformation: `PAY RUN ${runNumber}`,
    customerName: employee.name,
  }));
  return generateRbcCpa005CreditFile({
    mode: "test",
    clientNumber: "0000000000",
    fileCreationNumber: "TEST",
    fileCreationDate: "2026-08-30",
    processingCentre: "00390",
    destinationCurrency: "CAD",
    clientShortName: "COMCHEQ DEMO",
    clientLegalName: "Prairie North Services Ltd.",
    includeRoutingRecord: true,
  }, payments);
}

function demoAftPayments(runNumber: number, netPayDollars: readonly number[]): RbcCpa005Payment[] {
  if (netPayDollars.length !== demoEmployees.length) throw new Error("Demo net pay must include all four fictional employees.");
  return demoEmployees.map((employee, index) => ({
    ...employee,
    amountCents: dollarsToCents(netPayDollars[index]),
    paymentDate: "2026-09-04",
    transactionCode: "200",
    customerNumber: employee.employeeId,
    sundryInformation: `PAY RUN ${runNumber}`,
    customerName: employee.name,
  }));
}

export function buildDemoPaymentsCanadaAftFile(runNumber: number, netPayDollars: readonly number[]) {
  return generatePaymentsCanadaAftSimulation(demoAftPayments(runNumber, netPayDollars), { runNumber });
}

export function buildDemoAlbertaCalculation() {
  return calculateAlbertaPayroll({
    payDate: "2026-01-02",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: 52,
    periodsRemainingIncludingCurrent: 52,
    cashEarningsCents: dollarsToCents("1300.00"),
    registeredPlanDeductionCents: dollarsToCents("80.00"),
    yearToDate: {
      pensionableEarningsCents: 0,
      cppCents: 0,
      cpp2Cents: 0,
      eiCents: 0,
    },
  });
}
