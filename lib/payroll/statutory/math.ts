import { assertMoneyCents, type MoneyCents } from "../money.ts";

export function roundDivide(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new TypeError("roundDivide requires safe integers and a positive denominator.");
  }
  return Math.round(numerator / denominator);
}

export function multiplyRate(valueCents: MoneyCents, rateBasisPoints: number): MoneyCents {
  assertMoneyCents(valueCents);
  return roundDivide(valueCents * rateBasisPoints, 10_000);
}

export function multiplyFraction(valueCents: MoneyCents, numerator: number, denominator: number): MoneyCents {
  assertMoneyCents(valueCents);
  return roundDivide(valueCents * numerator, denominator);
}

export function nonNegative(value: MoneyCents): MoneyCents {
  assertMoneyCents(value);
  return Math.max(0, value);
}
