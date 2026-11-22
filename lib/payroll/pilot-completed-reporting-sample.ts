import { FICTIONAL_PILOT_PROFILE, FICTIONAL_PILOT_STATE } from "@/lib/payroll/pilot-fictional-scenario";
import { PILOT_RUN_KEY, PILOT_RUN_PERIOD, type PilotUatState } from "@/lib/payroll/pilot-uat";
import { pilotRunFingerprint } from "@/lib/payroll/pilot-run-fingerprint";
import { createPilotCompletedSnapshot, type PilotCompletedSnapshot } from "@/lib/payroll/pilot-completed-archive";

/** Read-only fictional reporting specimen: does not modify an active pay run. */
export function makePilotCompletedReportingSample(): PilotCompletedSnapshot {
  const original = FICTIONAL_PILOT_STATE.timesheets["EMP-0002"];
  const state: PilotUatState = {
    ...FICTIONAL_PILOT_STATE,
    ready: true,
    timesheets: {
      ...FICTIONAL_PILOT_STATE.timesheets,
      "EMP-0002": {
        ...original,
        regular: 80,
        overtime: 2.5,
        vacation: 0,
        allocationTarget: { regular: 80, overtime: 2.5, vacation: 0 },
        rateSplits: [
          { effectiveFrom: "2026-08-16", regular: 40, overtime: 0, vacation: 0 },
          { effectiveFrom: "2026-08-24", regular: 40, overtime: 2.5, vacation: 0 },
        ],
      },
    },
  };
  const fingerprint = pilotRunFingerprint({
    runKey: PILOT_RUN_KEY,
    ...PILOT_RUN_PERIOD,
    province: FICTIONAL_PILOT_PROFILE.province,
    frequency: FICTIONAL_PILOT_PROFILE.frequency,
    employees: state.employees as Array<Record<string, unknown> & { id: string }>,
    timesheets: state.timesheets,
    openingBalances: state.openingBalances ?? {},
  });
  const ids = state.employees.map((employee) => employee.id);
  const payments = {
    approved: true,
    approvedFingerprint: fingerprint,
    paidEmployeeIds: ids,
    references: {
      "EMP-0001": "DEMO-CHQ-001",
      "EMP-0002": "DEMO-ETR-002",
      "EMP-0003": "DEMO-ETR-003",
      "EMP-0004": "DEMO-ETR-004",
    },
    completedAt: "2026-09-04T17:00:00.000Z",
  };
  const snapshot = createPilotCompletedSnapshot(
    state,
    FICTIONAL_PILOT_PROFILE,
    payments,
    { "EMP-0001": "Business cheque" },
  );
  if (!snapshot) throw new Error("The fictional sample did not pass completed-payroll controls.");
  const noah = snapshot.rows.find((row) => row.id === "EMP-0002");
  if (!noah || Math.round(noah.gross * 100) !== 253625) {
    throw new Error("The fictional sample failed Noah's split-rate gross-pay validation.");
  }
  return { ...snapshot, sample: true, id: `sample|${snapshot.id}` };
}
