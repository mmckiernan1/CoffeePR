export type MoneyCents = number;

export function assertMoneyCents(value: number, label = "amount"): asserts value is MoneyCents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of cents.`);
  }
}

export function dollarsToCents(value: number | string): MoneyCents {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Dollar amount must be finite.");
    return Math.round((value + Number.EPSILON) * 100);
  }

  const normalized = value.trim().replaceAll(",", "").replace(/^\$/, "");
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) throw new TypeError(`Invalid dollar amount: ${value}`);

  const sign = match[1] === "-" ? -1 : 1;
  const dollars = Number(match[2]);
  const cents = Number((match[3] ?? "").padEnd(2, "0"));
  const result = sign * (dollars * 100 + cents);
  assertMoneyCents(result);
  return result;
}

export function sumCents(values: readonly MoneyCents[]): MoneyCents {
  return values.reduce((total, value) => {
    assertMoneyCents(value);
    const next = total + value;
    assertMoneyCents(next, "sum");
    return next;
  }, 0);
}

export function formatCad(value: MoneyCents): string {
  assertMoneyCents(value);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(value / 100);
}
