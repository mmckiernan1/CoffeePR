import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_PILOT_TAX_SETUP_REVIEW,
  normalizePilotTaxSetupReview,
  pilotEmployeeTaxSetupReady,
  pilotTaxSetupReviewComplete,
} from "../lib/payroll/pilot-tax-setup.ts";

test("statutory setup is incomplete until all four review items are confirmed", () => {
  assert.equal(pilotTaxSetupReviewComplete(EMPTY_PILOT_TAX_SETUP_REVIEW), false);
  assert.equal(pilotTaxSetupReviewComplete({
    federalTd1: true,
    provincialTd1: true,
    cppEi: true,
    openingYtd: false,
  }), false);
  assert.equal(pilotTaxSetupReviewComplete({
    federalTd1: true,
    provincialTd1: true,
    cppEi: true,
    openingYtd: true,
  }), true);
});

test("active employees explicitly imported as tax-setup incomplete remain blocked", () => {
  assert.equal(pilotEmployeeTaxSetupReady({ status: "Active", taxSetupComplete: false }), false);
  assert.equal(pilotEmployeeTaxSetupReady({ status: "Active", taxSetupComplete: true }), true);
  assert.equal(pilotEmployeeTaxSetupReady({ status: "Active" }), true);
});

test("new hires require explicit completion or complete review evidence", () => {
  assert.equal(pilotEmployeeTaxSetupReady({ status: "New hire" }), false);
  assert.equal(pilotEmployeeTaxSetupReady({ status: "New hire", taxSetupComplete: true }), true);
  assert.equal(pilotEmployeeTaxSetupReady({
    status: "New hire",
    taxSetupReview: { federalTd1: true, provincialTd1: true, cppEi: true, openingYtd: true },
  }), true);
});

test("statutory setup review accepts a valid evidence timestamp", () => {
  const review = normalizePilotTaxSetupReview({
    federalTd1: true,
    provincialTd1: true,
    cppEi: true,
    openingYtd: true,
    reviewedAt: "2026-09-05T22:00:00.000Z",
  });
  assert.equal(review?.reviewedAt, "2026-09-05T22:00:00.000Z");
});

test("statutory setup review rejects malformed evidence", () => {
  assert.equal(normalizePilotTaxSetupReview({
    federalTd1: true,
    provincialTd1: true,
    cppEi: "yes",
    openingYtd: true,
  }), null);
  assert.equal(normalizePilotTaxSetupReview({
    federalTd1: true,
    provincialTd1: true,
    cppEi: true,
    openingYtd: true,
    reviewedAt: "not-a-date",
  }), null);
});
