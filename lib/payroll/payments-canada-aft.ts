import { generateRbcCpa005CreditFile, type RbcCpa005Payment } from "./rbc-cpa005.ts";

export const PAYMENTS_CANADA_AFT_SIMULATION = {
  standard: "Payments Canada Standard 005",
  logicalRecordLength: 1464,
  mode: "SIMULATION ONLY — NOT BANK-SUBMITTABLE",
} as const;

export type PaymentsCanadaAftSimulationPayment = RbcCpa005Payment;

export function generatePaymentsCanadaAftSimulation(
  payments: readonly PaymentsCanadaAftSimulationPayment[],
  options: { runNumber: number; fileCreationDate?: string } = { runNumber: 1 },
) {
  if (!Number.isInteger(options.runNumber) || options.runNumber < 1 || options.runNumber > 9999) {
    throw new Error("runNumber must be an integer from 1 to 9999.");
  }

  const file = generateRbcCpa005CreditFile({
    mode: "test",
    clientNumber: "0000000000",
    fileCreationNumber: "TEST",
    fileCreationDate: options.fileCreationDate ?? "2026-08-30",
    processingCentre: "00000",
    destinationCurrency: "CAD",
    clientShortName: "COMCHEQ DEMO",
    clientLegalName: "Prairie North Services Ltd.",
    includeRoutingRecord: false,
  }, payments);

  return {
    ...file,
    descriptor: PAYMENTS_CANADA_AFT_SIMULATION,
  };
}
