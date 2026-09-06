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
type PaymentState = { approved: boolean; approvedFingerprint?: string | null; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null; approvalHistory?: ApprovalSnapshot[] };
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
  const [payments, setPayments] = useState<PaymentState>({ approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {}, completedAt: null, approvalHistory: [] });
  const [uat, setUat] = useState<UatState | null>(null);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [approvalStale, setApprovalStale] = useState(false);

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
          if (!cancelled) { setPayments(data.state); setApprovalStale(Boolean(data.approvalStale)); }
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
  const approvalTime = latestApproval ? new Date(latestApproval.approvedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : null;
  const completionTime = payments.completedAt ? new Date(payments.completedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-10 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll</div></div></div>

        <section className="mt-8 rounded-[30px] border border-[#decdbd] bg-[#fffaf5] p-7 shadow-[0_24px_70px_rgba(72,42,24,0.12)] sm:p-10">
          {complete ? (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e8efdf] text-4xl text-[#3d5a2f]">✓</div>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight">You did your payroll.</h1>
                <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#745948]">{profile.businessName}’s Run 17 is approved, every employee payment is confirmed, and each payment has a bank reference.</p>
                {completionTime && <p className="mt-2 text-xs font-semibold text-[#6f7f66]">Completed {completionTime}</p>}
              </div>

              <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4 text-center"><div className="text-xs text-[#856f60]">Employees</div><div className="mt-1 text-2xl font-bold">{employeeCount}</div></div>
                <div className="rounded-2xl border border-[#cfe0c2] bg-[#f6fbf2] p-4 text-center"><div className="text-xs text-[#5e7651]">Paid</div><div className="mt-1 text-2xl font-bold text-[#3d5a2f]">{paidCount}</div></div>
                <div className="rounded-2xl border border-[#cfe0c2] bg-[#f6fbf2] p-4 text-center"><div className="text-xs text-[#5e7651]">Bank refs</div><div className="mt-1 text-2xl font-bold text-[#3d5a2f]">{referenceCount}</div></div>
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4 text-center"><div className="text-xs text-[#856f60]">Status</div><div className="mt-1 text-lg font-bold">Complete</div></div>
              </div>

              {latestApproval && (
                <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5f7654]">Approval record</p><p className="mt-1 text-sm font-semibold text-[#3d5a2f]">This payroll has a saved approval snapshot.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#5f7654]">{latestApproval.employees.length} employee{latestApproval.employees.length === 1 ? "" : "s"}</span></div>
                  <div className="mt-4 grid gap-2 text-xs text-[#5f7654] sm:grid-cols-2"><div><span className="font-semibold">Approved:</span> {approvalTime}</div><div><span className="font-semibold">Approved by:</span> {latestApproval.approvedBy}</div><div><span className="font-semibold">Run:</span> {latestApproval.run.runKey}</div><div><span className="font-semibold">Snapshot:</span> {latestApproval.fingerprint.slice(0, 18)}…</div></div>
                </div>
              )}

              <div className="mt-8 border-t border-[#eadfd4] pt-7">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#967663]">A few useful things before you go</p><h2 className="mt-1 text-2xl font-semibold">Payroll is done. The follow-up is here when you need it.</h2></div><div className="rounded-xl bg-[#f3e6da] px-4 py-2.5 text-right"><div className="text-xs text-[#806858]">Next pay date</div><div className="mt-0.5 font-semibold">{nextDate}</div></div></div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => router.push("/?workspace=reports")} className="rounded-2xl border border-[#e2d4c8] bg-white p-5 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">Pay statements</div><p className="mt-1 text-xs leading-5 text-[#806858]">Open the employee statements from this payroll.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">View statements →</span></button>
                  <button onClick={() => router.push("/?workspace=reports")} className="rounded-2xl border border-[#e2d4c8] bg-white p-5 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">Payroll register</div><p className="mt-1 text-xs leading-5 text-[#806858]">Keep the employee detail and payroll totals together.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Open register →</span></button>
                  <button onClick={() => router.push("/uat/review")} className="rounded-2xl border border-[#e2d4c8] bg-white p-5 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">CRA obligation</div><p className="mt-1 text-xs leading-5 text-[#806858]">Review the calculated CRA amount. The remittance due date depends on the employer&apos;s CRA remitter schedule and is not yet configured in this pilot.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Review CRA amount →</span></button>
                  <button onClick={() => router.push("/?workspace=reports")} className="rounded-2xl border border-[#e2d4c8] bg-white p-5 text-left transition hover:border-[#c6a78c]"><div className="text-sm font-semibold">Accounting entry</div><p className="mt-1 text-xs leading-5 text-[#806858]">Open the payroll reports area for the journal-entry support and audit records.</p><span className="mt-3 inline-block text-xs font-semibold text-[#5a321f]">Open accounting support →</span></button>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] px-5 py-4 text-sm leading-6 text-[#4f6944]">Coffee Payroll recorded the pilot payment checklist and bank references you entered. The business owner remains in control of the actual e-transfers and CRA remittance through their bank.</div>

              <div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={() => router.push("/?workspace=reports")} className="rounded-xl border border-[#d6c6b8] bg-white px-5 py-3 font-semibold">Reports & statements</button><button onClick={() => router.push("/")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Back to main menu</button></div>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f3e6da] text-3xl">…</div>
              <h1 className="mt-6 text-3xl font-semibold">{approvalStale ? "Payroll changed after approval" : "Payroll is not finished yet"}</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#745948]">{approvalStale ? "An employee, rate, time or final-pay input changed. Review the updated payroll and approve it again before Coffee Payroll can mark this run complete." : "Approval, every employee payment, and a bank confirmation/reference for each payment must all be present before Coffee Payroll marks the run complete."}</p>
              <div className="mt-7 flex justify-center"><button onClick={() => router.push(approvalStale ? "/guided-payroll" : "/uat/payments")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">{approvalStale ? "Review payroll again" : "Return to employee payments"}</button></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
