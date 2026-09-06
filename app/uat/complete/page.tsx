"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isEmployeeInPayPeriod } from "@/lib/payroll/employee-lifecycle";

type ApprovalSnapshot = {
  approvedAt: string;
  approvedBy: string;
  fingerprint: string;
  run: { runKey: string; periodStart: string; periodEnd: string; payDate: string };
  employees: Array<{ id: string }>;
};
type ReopenEvent = { reopenedAt: string; reopenedBy: string; reason: string; priorCompletedAt: string };
type PaymentState = { approved: boolean; approvedFingerprint?: string | null; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null; approvalHistory?: ApprovalSnapshot[]; reopenHistory?: ReopenEvent[] };
type UatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  terminationDate?: string;
};
type UatState = { employees: UatEmployee[]; timesheets: Record<string, { regular: number; overtime: number; vacation: number }>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };

const paymentKey = "coffee-payroll:pilot-payments";
const uatKey = "coffee-payroll:pilot-uat";
const runPeriod = { periodStart: "2026-08-16", periodEnd: "2026-08-31", payDate: "2026-09-04" } as const;

function employeeIsInRun(employee: UatEmployee) {
  try {
    return isEmployeeInPayPeriod({ hireDate: employee.hireDate ?? "2020-01-01", terminationDate: employee.terminationDate ?? null, status: employee.status }, runPeriod);
  } catch {
    return true;
  }
}

function nextPayDate(frequency: string) {
  const payDate = new Date(`${runPeriod.payDate}T12:00:00`);
  const days = frequency === "Weekly" ? 7 : frequency === "Biweekly" ? 14 : null;
  if (days) payDate.setDate(payDate.getDate() + days);
  else if (frequency === "Semi-monthly") payDate.setDate(payDate.getDate() + 15);
  else payDate.setMonth(payDate.getMonth() + 1);
  return payDate.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}

export default function PilotCompletePage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentState>({ approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {}, completedAt: null, approvalHistory: [], reopenHistory: [] });
  const [uat, setUat] = useState<UatState | null>(null);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [approvalStale, setApprovalStale] = useState(false);
  const [workspaceConnected, setWorkspaceConnected] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [paymentResponse, workspaceResponse] = await Promise.all([
          fetch("/api/pilot/payments", { cache: "no-store" }),
          fetch("/api/pilot/workspace", { cache: "no-store" }),
        ]);
        if (paymentResponse.ok) {
          const data = await paymentResponse.json();
          if (!cancelled) { setPayments(data.state); setApprovalStale(Boolean(data.approvalStale)); setWorkspaceConnected(true); }
        } else {
          const raw = window.localStorage.getItem(paymentKey);
          if (raw && !cancelled) setPayments(JSON.parse(raw));
        }
        if (workspaceResponse.ok) {
          const data = await workspaceResponse.json();
          if (!cancelled) { setUat(data.state); setProfile(data.profile); }
        } else {
          const raw = window.localStorage.getItem(uatKey);
          if (raw && !cancelled) setUat(JSON.parse(raw));
        }
      } catch {
        try {
          const payRaw = window.localStorage.getItem(paymentKey);
          const uatRaw = window.localStorage.getItem(uatKey);
          if (payRaw && !cancelled) setPayments(JSON.parse(payRaw));
          if (uatRaw && !cancelled) setUat(JSON.parse(uatRaw));
        } catch {
          // Keep safe empty state.
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const includedEmployees = useMemo(() => uat?.employees.filter(employeeIsInRun) ?? [], [uat]);
  const employeeCount = includedEmployees.length;
  const paidCount = useMemo(() => includedEmployees.filter((employee) => payments.paidEmployeeIds.includes(employee.id)).length, [includedEmployees, payments]);
  const referenceCount = useMemo(() => includedEmployees.filter((employee) => Boolean(payments.references[employee.id]?.trim())).length, [includedEmployees, payments.references]);
  const complete = Boolean(!approvalStale && payments.approved && payments.completedAt && employeeCount > 0 && paidCount === employeeCount && referenceCount === employeeCount);
  const nextDate = nextPayDate(profile.frequency);
  const latestApproval = payments.approvalHistory?.at(-1) ?? null;
  const latestReopen = payments.reopenHistory?.at(-1) ?? null;
  const approvalTime = latestApproval ? new Date(latestApproval.approvedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : null;
  const completionTime = payments.completedAt ? new Date(payments.completedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : null;

  async function reopenPayroll() {
    const reason = correctionReason.trim();
    if (reason.length < 10) {
      setCorrectionError("Please add a short reason so the correction has a useful audit trail.");
      return;
    }
    if (!workspaceConnected) {
      setCorrectionError("Reconnect to the pilot workspace before reopening a completed payroll.");
      return;
    }
    setReopening(true);
    setCorrectionError("");
    try {
      const response = await fetch("/api/pilot/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reopenReason: reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Payroll could not be reopened.");
      window.localStorage.setItem(paymentKey, JSON.stringify(payload.state));
      router.push("/guided-payroll");
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Payroll could not be reopened.");
      setReopening(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-8 text-[#332118] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5a321f] text-lg text-white">☕</div><div><div className="text-xl font-semibold">Coffee Payroll</div><div className="text-[9px] tracking-[0.3em] text-[#846755]">stress free payroll</div></div></div>

        <section className="mt-7 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-[0_20px_60px_rgba(72,42,24,0.10)] sm:p-9">
          {complete ? (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8efdf] text-3xl font-bold text-[#3d5a2f]">✓</div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#6f7f66]">Payroll complete</p>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight">You did your payroll.</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#745948]">{profile.businessName}’s Run 17 is approved and every employee payment has been confirmed.</p>
                {completionTime && <p className="mt-2 text-xs text-[#7d746c]">Completed {completionTime}</p>}
              </div>

              <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4 text-center"><div className="text-xs text-[#856f60]">Employees paid</div><div className="mt-1 text-2xl font-bold">{paidCount}</div></div>
                <div className="rounded-2xl border border-[#cfe0c2] bg-[#f6fbf2] p-4 text-center"><div className="text-xs text-[#5e7651]">Payment records</div><div className="mt-1 text-2xl font-bold text-[#3d5a2f]">{referenceCount}</div></div>
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4 text-center"><div className="text-xs text-[#856f60]">Next pay date</div><div className="mt-1 text-sm font-bold">{nextDate}</div></div>
              </div>

              <div className="mx-auto mt-7 max-w-2xl rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] px-5 py-4 text-sm leading-6 text-[#4f6944]"><strong>Everything for this payroll is saved.</strong> The approved run, employee payment confirmations and bank references are kept with the payroll record.</div>

              <div className="mx-auto mt-7 max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#967663]">What you may need next</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <button onClick={() => router.push("/?workspace=reports")} className="rounded-2xl border border-[#e2d4c8] bg-white p-4 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">Pay statements</div><p className="mt-1 text-xs leading-5 text-[#806858]">Employee payroll records and statements.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Open reports →</span></button>
                  <button onClick={() => router.push("/uat/review")} className="rounded-2xl border border-[#e2d4c8] bg-white p-4 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">CRA amount</div><p className="mt-1 text-xs leading-5 text-[#806858]">Review the calculated remittance amount.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Review CRA →</span></button>
                  <button onClick={() => router.push("/?workspace=reports")} className="rounded-2xl border border-[#e2d4c8] bg-white p-4 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">Payroll register</div><p className="mt-1 text-xs leading-5 text-[#806858]">Payroll totals and employee detail.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Open register →</span></button>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#806858]">CRA remittance timing depends on the employer&apos;s remitter schedule and is not yet configured in this pilot.</p>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => router.push("/?workspace=reports")} className="rounded-xl border border-[#d6c6b8] bg-white px-5 py-3 text-sm font-semibold">Reports & statements</button><button onClick={() => router.push("/")} className="rounded-xl bg-[#5a321f] px-5 py-3 text-sm font-semibold text-white">Back to main menu</button></div>

              <div className="mx-auto mt-8 max-w-2xl border-t border-[#eadfd4] pt-5">
                <button onClick={() => setShowDetails((current) => !current)} className="text-xs font-semibold text-[#806858] underline decoration-[#c8b4a3] underline-offset-4">{showDetails ? "Hide payroll record details" : "Payroll record details"}</button>
                {showDetails && <div className="mt-4 space-y-3">
                  {latestApproval && <div className="rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-4 text-xs text-[#5f7654]"><p className="font-semibold">Approval record</p><div className="mt-2 grid gap-1 sm:grid-cols-2"><div><span className="font-semibold">Approved:</span> {approvalTime}</div><div><span className="font-semibold">Approved by:</span> {latestApproval.approvedBy}</div><div><span className="font-semibold">Run:</span> {latestApproval.run.runKey}</div><div><span className="font-semibold">Snapshot:</span> {latestApproval.fingerprint.slice(0, 18)}…</div></div></div>}
                  {latestReopen && <div className="rounded-2xl border border-[#e6d6c7] bg-white p-4 text-xs text-[#806858]"><strong>Previous correction recorded:</strong> {latestReopen.reason}</div>}
                </div>}
              </div>

              <div className="mx-auto mt-5 max-w-2xl">
                {!showCorrection ? <button onClick={() => setShowCorrection(true)} className="text-xs font-semibold text-[#806858] underline decoration-[#c8b4a3] underline-offset-4">Need to correct this payroll?</button> : <div className="rounded-2xl border border-[#e2c4a8] bg-[#fff8ee] p-5"><div className="font-semibold text-[#6e452b]">Reopen for correction</div><p className="mt-1 text-xs leading-5 text-[#806858]">Reopening keeps the completed record and your reason in the audit history. You will need to review and approve the corrected payroll again.</p><label className="mt-4 block text-xs font-semibold text-[#745948]">Why does this payroll need to be corrected?<textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value.slice(0, 500))} rows={3} placeholder="Example: An employee reported 4 missing regular hours after payroll was completed." className="mt-1.5 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5 text-sm font-normal" /></label>{correctionError && <div className="mt-2 text-xs font-semibold text-[#9a4f28]">{correctionError}</div>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={reopenPayroll} disabled={reopening || correctionReason.trim().length < 10} className="rounded-xl bg-[#7b3f20] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-35">{reopening ? "Reopening…" : "Reopen payroll"}</button><button onClick={() => { setShowCorrection(false); setCorrectionError(""); }} className="rounded-xl border border-[#d6c6b8] bg-white px-4 py-2.5 text-sm font-semibold">Cancel</button></div></div>}
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3e6da] text-2xl">…</div>
              <h1 className="mt-5 text-3xl font-semibold">{approvalStale ? "Payroll changed after approval" : "Payroll is not finished yet"}</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#745948]">{approvalStale ? "An employee, rate, time or final-pay input changed. Review the updated payroll and approve it again before Coffee Payroll can mark this run complete." : "Approval, every employee payment, and a bank confirmation/reference for each payment must all be present before Coffee Payroll marks the run complete."}</p>
              <div className="mt-7 flex justify-center"><button onClick={() => router.push(approvalStale ? "/guided-payroll" : "/uat/payments")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">{approvalStale ? "Review payroll again" : "Return to employee payments"}</button></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
