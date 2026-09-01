function validIsoDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} is invalid.`);
  return date;
}

export function addUtcMonths(value: string, months: number): string {
  const date = validIsoDate(value, "date");
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error("months is outside the supported range.");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const finalDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, finalDay));
  return date.toISOString().slice(0, 10);
}

export function monthlyRemittanceDueDate(payDate: string): string {
  const date = validIsoDate(payDate, "payDate");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 15)).toISOString().slice(0, 10);
}

export function remittanceLiabilityCents(lines: readonly { incomeTaxCents: number; cppCents: number; cpp2Cents: number; eiCents: number }[]): number {
  return lines.reduce((sum, line) => {
    for (const value of [line.incomeTaxCents, line.cppCents, line.cpp2Cents, line.eiCents]) {
      if (!Number.isInteger(value) || value < 0) throw new Error("Remittance inputs must be non-negative integer cents.");
    }
    return sum + line.incomeTaxCents + (line.cppCents + line.cpp2Cents) * 2 + line.eiCents + Math.round(line.eiCents * 1.4);
  }, 0);
}

export function validateOvertimeBankMovement(input: { earnedHundredths: number; usedHundredths: number; currentBalanceHundredths: number; agreementActive: boolean }) {
  for (const [label, value] of [["earnedHundredths", input.earnedHundredths], ["usedHundredths", input.usedHundredths], ["currentBalanceHundredths", input.currentBalanceHundredths]] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new Error(`${label} is outside the supported range.`);
  }
  if (input.earnedHundredths > 0 && !input.agreementActive) throw new Error("A current written overtime agreement is required before hours can be banked.");
  if (input.usedHundredths > input.currentBalanceHundredths + input.earnedHundredths) throw new Error("Banked overtime used cannot exceed the available balance.");
  return input.currentBalanceHundredths + input.earnedHundredths - input.usedHundredths;
}
