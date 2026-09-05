"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";
import { dollarsToCents } from "@/lib/payroll/money";

type UatEmployee = { id: string; name: string; payType: "Salary" | "Hourly"; rate: number; status: "Active" | "New hire" };
type Timesheet = { regular: number; overtime: number; vacation: number };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };
type PaymentState = { approved: boolean; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null };

const uatKey = "coffee-payroll:pilot-uat";
const paymentKey = "coffee-payroll:pilot-payments";
const emptyPayments: PaymentState = { approved: false, paidEmployeeIds: [], references: {}, completedAt: null };

const starterState: UatState = {
  employees: [
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, status: "Active" },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, status: "Active" },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, status: "Active" },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, status: "Active" },
  ],
  timesheets: { "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 }, "EMP-0004": { regular: 72, overtime: 0, vacation: 0 } },
  ready: false,
};

const baselineYtd: Record<string, { pensionableEarningsCents: number; cppCents: number; cpp2Cents: number; eiCents: number }> = {
  "EMP-0001": { pensionableEarningsCents: 4_923_072, cppCents: 280_000, cpp2Cents: 0, eiCents: 80_000 },
  "EMP-0002": { pensionableEarningsCents: 3_600_000, cppCents: 210_000, cpp2Cents: 0, eiCents: 58_000 },
  "EMP-0003": { pensionableEarningsCents: 6_826_923, cppCents: 390_000, cpp2Cents: 0, eiCents: 111_000 },
  "EMP-0004": { pensionableEarningsCents: 2_900_000, cppCents: 165_000, cpp2Cents: 0, eiCents: 47_000 },
};

function periodsPerYear(frequency: string): 12 | 24 | 26 | 52 {
  if (frequency === "Weekly") return 52;
  if (frequency === "Semi-monthly") return 24;
  if (frequency === "Monthly") return 12;
  return 26;
}

function netPay(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string) {
  const ppy = periodsPerYear(frequency);
  const time = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
  const gross = employee.payType === "Salary"
    ? employee.rate / ppy
    : time.regular * employee.rate + time.overtime * employee.rate * 1.5 + time.vacation * employee.rate;
  const result = calculateAlbertaPayroll({
    payDate: "2026-09-04",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: ppy,
    periodsRemainingIncludingCurrent: Math.max(1, Math.round(ppy * 0.33)),
    cashEarningsCents: dollarsToCents(gross.toFixed(2)),
    federalClaimCents: 1_645_200,
    albertaClaimCents: 2_276_900,
    yearToDate: baselineYtd[employee.id] ?? { pensionableEarningsCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0 },
  });
  return result.netPayCents / 100;
}

export default function PilotPaymentsPage() {
  const router = useRouter();
  const [uat, setUat] = useState<UatState>(starterState);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [payments, setPayments] = useState<PaymentState>(emptyPayments);
  const [sync, setSync] = useState<"loading" | "workspace" | "device" | "saving">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const workspace = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (workspace.ok) {
          const data = await workspace.json();
          if (!cancelled) { setUat(data.state); setProfile(data.profile); }
        } else {
          const raw = window.localStorage.getItem(uatKey);
          if (raw && !cancelled) setUat(JSON.parse(raw));
        }

        const paymentResponse = await fetch("/api/pilot/payments", { cache: "no-store" });
        if (paymentResponse.ok) {
          const data = await paymentResponse.json();
          if (!cancelled) { setPayments(data.state); setSync("workspace"); }
          return;
        }
      } catch {
        // Device fallback below.
      }
      try {
        const raw = window.localStorage.getItem(paymentKey);
        if (raw && !cancelled) setPayments(JSON.parse(raw));
      } catch {
        // Keep empty fictional payment state.
      }
      if (!cancelled) setSync("device");
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => profile.province === "Alberta" ? uat.employees.map((employee) => ({ employee, net: netPay(employee, uat.timesheets, profile.frequency) })) : [], [uat, profile]);
  const allPaid = rows.length > 0 && rows.every(({ employee }) => payments.paidEmployeeIds.includes(employee.id));
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0);

  async function save(next: PaymentState) {
    setPayments(next);
    window.localStorage.setItem(paymentKey, JSON.stringify(next));
    if (sync === "device") return;
    setSync("saving");
    try {
      const response = await fetch("/api/pilot/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("save failed");
      setSync("workspace");
    } catch {
      setSync("device");
    }
  }

  function togglePaid(id: string) {
    const paid = payments.paidEmployeeIds.includes(id);
    void save({ ...payments, paidEmployeeIds: paid ? payments.paidEmployeeIds.filter((item) => item !== id) : [...payments.paidEmployeeIds, id], completedAt: null });
  }

  function updateReference(id: string, value: string) {
    void save({ ...payments, references: { ...payments.references, [id]: value.slice(0, 120) }, completedAt: null });
  }

  async function finishPayroll() {
    if (!payments.approved || !allPaid) return;
    const next = { ...payments, completedAt: new Date().toISOString() };
    await save(next);
    router.push("/uat/complete");
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · pay employees</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <section className="mt-7 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Employee payments</p><h1 className="mt-2 text-3xl font-semibold">Send the e-transfers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">Use your business banking to send each employee their net pay. Coffee Payroll records the checklist and reference; it does not move the money.</p></div>
            <div className="rounded-2xl bg-[#f3e6da] px-5 py-3 text-right"><div className="text-xs text-[#7d6554]">Total net pay</div><div className="mt-1 text-xl font-bold">{totalNet.toLocaleString("en-CA", { style: "currency", currency: "CAD" })}</div></div>
          </div>

          {!payments.approved && <div className="mt-6 rounded-xl border border-[#e2b999] bg-[#fff6ec] px-4 py-3 text-sm text-[#714a32]">Payroll still needs approval. Return to the guided payroll and approve the run before confirming payments.</div>}

          <div className="mt-6 space-y-3">
            {rows.map(({ employee, net }) => {
              const paid = payments.paidEmployeeIds.includes(employee.id);
              return <div key={employee.id} className={`rounded-2xl border p-4 sm:p-5 ${paid ? "border-[#cfe0c2] bg-[#f6fbf2]" : "border-[#e2d4c8] bg-white"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#826b5a]">Business e-transfer · {employee.id}</div></div>
                  <div className="text-left sm:text-right"><div className="text-xs text-[#826b5a]">Send</div><div className="font-mono text-xl font-bold">{net.toLocaleString("en-CA", { style: "currency", currency: "CAD" })}</div></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="text-xs font-semibold text-[#745948]">Bank confirmation / reference<input value={payments.references[employee.id] ?? ""} onChange={(e) => updateReference(employee.id, e.target.value)} placeholder="e.g. Interac confirmation 123456" className="mt-1.5 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5 text-sm font-normal" /></label>
                  <button disabled={!payments.approved} onClick={() => togglePaid(employee.id)} className={`self-end rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${paid ? "border border-[#b9d2a9] bg-white text-[#3f6330]" : "bg-[#5a321f] text-white"}`}>{paid ? "✓ Paid" : "Mark paid"}</button>
                </div>
              </div>;
            })}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd4] pt-6">
            <span className="text-xs text-[#846f60]">{sync === "workspace" ? "Payment checklist saved to your pilot workspace" : sync === "saving" ? "Saving payment checklist…" : "Payment checklist saved on this device"}</span>
            <button disabled={!payments.approved || !allPaid} onClick={finishPayroll} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white disabled:opacity-35">{allPaid ? "Finish payroll" : `Paid ${payments.paidEmployeeIds.length} of ${rows.length}`}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
