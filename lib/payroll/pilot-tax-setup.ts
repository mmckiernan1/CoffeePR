export type PilotTaxSetupReview = {
  federalTd1: boolean;
  provincialTd1: boolean;
  cppEi: boolean;
  openingYtd: boolean;
  reviewedAt?: string;
};

export type PilotTaxSetupEmployee = {
  status?: string;
  taxSetupComplete?: boolean;
  taxSetupReview?: unknown;
};

export const EMPTY_PILOT_TAX_SETUP_REVIEW: PilotTaxSetupReview = {
  federalTd1: false,
  provincialTd1: false,
  cppEi: false,
  openingYtd: false,
};

export function normalizePilotTaxSetupReview(input: unknown): PilotTaxSetupReview | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<PilotTaxSetupReview>;
  if (![value.federalTd1, value.provincialTd1, value.cppEi, value.openingYtd].every((item) => typeof item === "boolean")) return null;
  if (value.reviewedAt !== undefined && (typeof value.reviewedAt !== "string" || value.reviewedAt.length > 40 || Number.isNaN(Date.parse(value.reviewedAt)))) return null;
  return {
    federalTd1: value.federalTd1 as boolean,
    provincialTd1: value.provincialTd1 as boolean,
    cppEi: value.cppEi as boolean,
    openingYtd: value.openingYtd as boolean,
    ...(value.reviewedAt ? { reviewedAt: value.reviewedAt } : {}),
  };
}

export function pilotTaxSetupReviewComplete(input: unknown): boolean {
  const review = normalizePilotTaxSetupReview(input);
  return Boolean(review && review.federalTd1 && review.provincialTd1 && review.cppEi && review.openingYtd);
}

export function pilotEmployeeTaxSetupReady(employee: PilotTaxSetupEmployee): boolean {
  if (employee.taxSetupComplete === true) return true;
  if (pilotTaxSetupReviewComplete(employee.taxSetupReview)) return true;
  if (employee.taxSetupComplete === false) return false;
  return employee.status !== "New hire";
}
