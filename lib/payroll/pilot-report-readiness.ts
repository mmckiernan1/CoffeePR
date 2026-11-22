import { pilotHourlyRateSplitReady, pilotEmployeeIsInRun, PILOT_RUN_KEY, PILOT_RUN_PERIOD, type PilotProfile, type PilotUatState } from "@/lib/payroll/pilot-uat";
import { pilotRunFingerprint } from "@/lib/payroll/pilot-run-fingerprint";

export type PilotReportApproval = { approved: boolean; approvedFingerprint?: string | null };

export type PilotReportReadiness = {
  ready: boolean;
  message: string;
  action: "hours" | "approval" | null;
};

/**
 * Protect payroll registers and pay statements against recalculating an
 * unfinished or changed pay run as if it were the approved payroll record.
 * In particular, never print Noah's entire pay at his new hourly rate if his
 * mid-period rate allocation is missing from this browser.
 */
export function pilotReportReadiness(
  state: PilotUatState,
  profile: PilotProfile,
  approval: PilotReportApproval,
): PilotReportReadiness {
  if (profile.province !== "Alberta") {
    return { ready: false, message: "This fictional payroll report currently supports Alberta only.", action: null };
  }

  const employees = state.employees.filter(pilotEmployeeIsInRun);
  const incomplete = employees.filter((employee) => !pilotHourlyRateSplitReady(employee, state.timesheets[employee.id]));
  if (incomplete.length) {
    return {
      ready: false,
      message: `Rate allocation is missing or incomplete for ${incomplete.map((employee) => employee.name).join(", ")}. Review hours before printing the payroll.`,
      action: "hours",
    };
  }

  if (!state.ready) {
    return { ready: false, message: "Hours and pay haven't been confirmed for this payroll. Review them before printing.", action: "hours" };
  }

  if (!approval.approved) {
    return { ready: false, message: "There isn't an approved payroll record in this browser yet. Complete the payroll review and approval before printing.", action: "approval" };
  }

  const currentFingerprint = pilotRunFingerprint({
    runKey: PILOT_RUN_KEY,
    ...PILOT_RUN_PERIOD,
    province: profile.province,
    frequency: profile.frequency,
    employees: state.employees as Array<Record<string, unknown> & { id: string }>,
    timesheets: state.timesheets,
    openingBalances: state.openingBalances ?? {},
  });

  if (approval.approvedFingerprint !== currentFingerprint) {
    return {
      ready: false,
      message: "The payroll inputs have changed since approval. Review and approve the updated payroll before printing.",
      action: "approval",
    };
  }

  return { ready: true, message: "", action: null };
}
