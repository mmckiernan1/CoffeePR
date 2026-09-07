export type PilotRunFingerprintInput = {
  runKey: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  province: string;
  frequency: string;
  employees: Array<Record<string, unknown> & { id: string }>;
  timesheets: Record<string, unknown>;
  openingBalances?: Record<string, unknown>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalPilotRun(input: PilotRunFingerprintInput) {
  const employees = [...input.employees]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((employee) => canonicalize(employee));

  return JSON.stringify(canonicalize({
    runKey: input.runKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    payDate: input.payDate,
    province: input.province,
    frequency: input.frequency,
    employees,
    timesheets: input.timesheets,
    openingBalances: input.openingBalances ?? {},
  }));
}

// FNV-1a is used only as a compact deterministic version marker. It is not a security hash.
export function pilotRunFingerprint(input: PilotRunFingerprintInput) {
  const text = canonicalPilotRun(input);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `uat-v1-${hash.toString(16).padStart(8, "0")}`;
}
