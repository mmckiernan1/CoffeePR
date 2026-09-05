"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";
import { dollarsToCents } from "@/lib/payroll/money";
import { buildFinalPay, isEmployeeInPayPeriod } from "@/lib/payroll/employee-lifecycle";

type FinalPay = { vacationPay: number; overtimePay: number; otherTaxablePay: number; reimbursement: number };
type UatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  rateEffectiveDate?: string;
  terminationDate?: string;
  extraTaxablePay?: number;
  changeNote?: string;
  finalPay?: FinalPay;
};
type Timesheet = { regular: number; overtime: number; vacation: number };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };
type Row = UatEmployee & { gross: number; reimbursement: number; incomeTax: number; cpp: number; cpp2: number; ei: number; net: number; employerCpp: number; employerEi: number };

const localStorageKey = "coffee-payroll:pilot-uat";
const runPeriod = { periodStart: "2026-08-16", periodEnd: "2026-08-31", payDate: "2026-09-04" } as const;
const starterState: UatState = {
  employees: [
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, status: "Active", hireDate: "2024-01-08" },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, status: "Active", hireDate: "2024-05-13" },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, status: "Active", hireDate: "2023-09-05" },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, status: "Active", hireDate: "2025-02-03" },
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

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
function periodsPerYear(frequency: string): 12 | 24 | 26 | 52 { if (frequency === "Weekly") return 52; if (frequency === "Semi-monthly") return 24; if (frequency === "Monthly") return 12; return 26; }
function employeeIsInRun(employee: UatEmployee) { try { return isEmployeeInPayPeriod({ hireDate: employee.hireDate ?? "2020-01-01", terminationDate: employee.terminationDate ?? null, status: employee.status }, runPeriod); } catch { return true; } }
function regularGross(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string) { if (employee.payType === "Salary") return employee.rate / periodsPerYear(frequency); const time = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 }; return time.regular * employee.rate + time.overtime * employee.rate * 1.5 + time.vacation * employee.rate; }

function calculateRow(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string): Row {
  const ordinaryGross = regularGross(employee, timesheets, frequency);
  const final = buildFinalPay({
    vacationPayCents: dollarsToCents(String(employee.finalPay?.vacationPay ?? 0)),
    overtimePayCents: dollarsToCents(String(employee.finalPay?.overtimePay ?? 0)),
    otherTaxablePayCents: dollarsToCents(String(employee.finalPay?.otherTaxablePay ?? 0)),
    reimbursementCents: dollarsToCents(String(employee.finalPay?.reimbursement ?? 0)),
  });
  const gross = ordinaryGross + (employee.extraTaxablePay ?? 0) + final.taxableGrossCents / 100;
  const reimbursement = final.reimbursementCents / 100;
  const ppy = periodsPerYear(frequency);
  const result = calculateAlbertaPayroll({
    payDate: runPeriod.payDate,
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: ppy,
    periodsRemainingIncludingCurrent: Math.max(1, Math.round(ppy * 0.33)),
    cashEarningsCents: dollarsToCents(gross.toFixed(2)),
    federalClaimCents: 1_645_200,
    albertaClaimCents: 2_276_900,
    yearToDate: baselineYtd[employee.id] ?? { pensionableEarningsCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0 },
  });
  return { ...employee, gross, reimbursement, incomeTax: result.deductions.incomeTaxCents / 100, cpp: result.deductions.cppCents / 100, cpp2: result.deductions.cpp2Cents / 100, ei: result.deductions.eiCents / 100, net: result.netPayCents / 100 + reimbursement, employerCpp: result.employerContributions.cppCents / 100, employerEi: result.employerContributions.eiCents / 100 };
}

function reviewLabel(employee: UatEmployee) {
  const labels: string[] = [];
  if (employee.status === "New hire") labels.push(`New hire${employee.hireDate ? ` · hired ${employee.hireDate}` : ""}`);
  if (employee.rateEffectiveDate) labels.push(`Pay changed ${employee.rateEffectiveDate}`);
  if ((employee.extraTaxablePay ?? 0) > 0) labels.push(`Extra pay ${cad.format(employee.extraTaxablePay ?? 0)}`);
  if (employee.status === "Terminating" || employee.status === "Terminated") labels.push(`Final pay · last day ${employee.terminationDate ?? "date needed"}`);
  if (employee.changeNote) labels.push(`Review note: ${employee.changeNote}`);
  return labels.join(" · ");
}

export default function UatReviewPage() {
  const router = useRouter();
  const [state, setState] = useState<UatState>(starterState);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [source, setSource] = useState("Loading UAT workspace…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) { const payload = await response.json(); if (!cancelled) { setState(payload.state); setProfile(payload.profile); setSource("Synced UAT workspace"); } return; }
      } catch { /* device fallback */ }
      try { const raw = window.localStorage.getItem(localStorageKey); if (raw && !cancelled) setState(JSON.parse(raw)); } catch { /* starter data */ }
      if (!cancelled) setSource("Saved on this device");
    })();
    return () => { cancelled = true; };
  }, []);

  const includedEmployees = useMemo(() => state.employees.filter(employeeIsInRun), [state.employees]);
  const unusualEmployees = useMemo(() => includedEmployees.filter((employee) => reviewLabel(employee)), [includedEmployees]);
  const excludedEmployees = useMemo(() => state.employees.filter((employee) => !employeeIsInRun(employee)), [state.employees]);
  const rows = useMemo(() => profile.province === "Alberta" ? includedEmployees.map((employee) => calculateRow(employee, state.timesheets, profile.frequency)) : [], [includedEmployees, state.timesheets, profile]);
  const totals = useMemo(() => rows.reduce((t, row) => ({ gross: t.gross + row.gross, tax: t.tax + row.incomeTax, cpp: t.cpp + row.cpp + row.cpp2, ei: t.ei + row.ei, net: t.net + row.net, employerCpp: t.employerCpp + row.employerCpp, employerEi: t.employerEi + row.employerEi }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0, employerCpp: 0, employerEi: 0 }), [rows]);
  const cra = totals.tax + totals.cpp + totals.ei + totals.employerCpp + totals.employerEi;
  const payrollFee = 18;
  const totalFunding = totals.net + cra + payrollFee;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · review</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 4 · Review</p><h1 className="mt-2 text-3xl font-semibold">Here&apos;s your payroll</h1><p className="mt-2 text-sm text-[#795f4f]">{profile.businessName} · Run 17 · August 16–31 · Pay September 4, 2026 · {source}</p></div>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${state.ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>{state.ready ? "✓ Hours ready" : "Hours need review"}</span>
          </div>

          {profile.province !== "Alberta" ? <div className="mt-6 rounded-xl border border-[#e2b999] bg-[#fff6ec] p-4 text-sm text-[#714a32]">The current validated pilot calculation pack is Alberta-only.</div> : <>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#e2d4c8] bg-white p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Who you&apos;re paying</div><div className="mt-2 text-3xl font-semibold">{rows.length}</div><div className="mt-1 text-sm text-[#795f4f]">employee{rows.length === 1 ? "" : "s"} in this payroll</div><div className="mt-4 space-y-2 text-sm">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3"><span className="truncate">{row.name}</span><strong>{cad.format(row.net)}</strong></div>)}</div></div>
              <div className="rounded-2xl border border-[#c9d9ef] bg-[#f7fbff] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#55769e]">Money to have ready</div><div className="mt-2 text-3xl font-semibold text-[#244f78]">{cad.format(totalFunding)}</div><div className="mt-4 space-y-2 text-sm text-[#55708a]"><div className="flex justify-between gap-3"><span>Employee e-transfers</span><strong>{cad.format(totals.net)}</strong></div><div className="flex justify-between gap-3"><span>CRA obligation</span><strong>{cad.format(cra)}</strong></div><div className="flex justify-between gap-3"><span>Coffee Payroll fee</span><strong>{cad.format(payrollFee)}</strong></div></div><p className="mt-4 text-xs leading-5 text-[#6b8197]">Employee e-transfers are the immediate bank payments in this pilot. CRA remains an obligation until remitted.</p></div>
              <div className={`rounded-2xl border p-5 ${unusualEmployees.length > 0 ? "border-[#e3c39f] bg-[#fff8ee]" : "border-[#d7e5ce] bg-[#f7fbf4]"}`}><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Anything unusual?</div><div className="mt-2 text-3xl font-semibold">{unusualEmployees.length}</div><div className="mt-1 text-sm text-[#795f4f]">employee{unusualEmployees.length === 1 ? "" : "s"} with a change to review</div>{unusualEmployees.length === 0 ? <p className="mt-4 text-sm text-[#4f6944]">Nothing unusual is flagged. Regular payroll carried forward as expected.</p> : <div className="mt-4 space-y-2">{unusualEmployees.map((employee) => <button key={employee.id} onClick={() => router.push("/uat/lifecycle")} className="w-full rounded-xl bg-white/80 px-3 py-2.5 text-left text-sm"><strong>{employee.name}</strong><div className="mt-1 text-xs leading-5 text-[#795f4f]">{reviewLabel(employee)}</div></button>)}</div>}</div>
            </div>

            {excludedEmployees.length > 0 && <div className="mt-4 rounded-xl border border-[#d9d5cf] bg-[#f8f6f3] p-4 text-sm text-[#675b52]">{excludedEmployees.length} employee{excludedEmployees.length === 1 ? " is" : "s are"} outside this pay period and excluded from the run.</div>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-4"><div><strong className="text-sm text-[#3d5a2f]">The important checks are above.</strong><p className="mt-1 text-xs leading-5 text-[#5f7654]">Open the calculation detail only if you want to inspect gross, tax, CPP, EI or final-pay components employee by employee.</p></div><button onClick={() => document.getElementById("calculation-detail")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-[#c9d8bf] bg-white px-4 py-2 text-sm font-semibold text-[#48613b]">See calculation detail</button></div>

            <div id="calculation-detail" className="mt-7 overflow-x-auto rounded-2xl border border-[#e2d4c8] bg-white"><table className="w-full min-w-[1060px] text-left text-sm"><thead className="bg-[#f8f0e8] text-xs uppercase tracking-wider text-[#806858]"><tr><th className="px-4 py-3">Employee</th><th>Input</th><th>Gross</th><th>Extra / final pay</th><th>Income tax</th><th>CPP</th><th>EI</th><th>Net pay</th></tr></thead><tbody>{rows.map((row) => { const time = state.timesheets[row.id]; const finalTaxable = (row.finalPay?.vacationPay ?? 0) + (row.finalPay?.overtimePay ?? 0) + (row.finalPay?.otherTaxablePay ?? 0); const extra = (row.extraTaxablePay ?? 0) + finalTaxable; return <tr key={row.id} className={`border-t border-[#eee3da] ${reviewLabel(row) ? "bg-[#fffaf2]" : ""}`}><td className="px-4 py-4 font-semibold">{row.name}<div className="mt-1 text-xs font-normal text-[#8a7364]">{reviewLabel(row) || row.status}</div></td><td>{row.payType === "Hourly" ? `${time?.regular ?? 0} reg · ${time?.overtime ?? 0} OT @ ${cad.format(row.rate)}/hr` : `${cad.format(row.rate)}/yr`}</td><td>{cad.format(row.gross)}</td><td>{extra > 0 || row.reimbursement > 0 ? <span>{extra > 0 ? <strong>{cad.format(extra)} taxable</strong> : null}{row.reimbursement > 0 ? ` · ${cad.format(row.reimbursement)} reimb.` : ""}</span> : "—"}</td><td>{cad.format(row.incomeTax)}</td><td>{cad.format(row.cpp + row.cpp2)}</td><td>{cad.format(row.ei)}</td><td className="font-semibold">{cad.format(row.net)}</td></tr>; })}</tbody></table></div>

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[#eadfd4] pt-5"><button onClick={() => router.push("/uat/time")} className="rounded-xl border border-[#d6c6b8] bg-white px-4 py-2.5 text-sm font-semibold">Edit hours</button><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">This payroll looks right</button></div>
          </>}
        </section>
      </div>
    </main>
  );
}
