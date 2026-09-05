"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";
import { dollarsToCents } from "@/lib/payroll/money";

type UatEmployee = { id: string; name: string; payType: "Salary" | "Hourly"; rate: number; status: "Active" | "New hire" };
type Timesheet = { regular: number; overtime: number; vacation: number };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };
type Row = UatEmployee & { gross: number; incomeTax: number; cpp: number; cpp2: number; ei: number; net: number; employerCpp: number; employerEi: number };

const localStorageKey = "coffee-payroll:pilot-uat";
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

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function periodsPerYear(frequency: string): 12 | 24 | 26 | 52 {
  if (frequency === "Weekly") return 52;
  if (frequency === "Semi-monthly") return 24;
  if (frequency === "Monthly") return 12;
  return 26;
}

function grossFor(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string) {
  if (employee.payType === "Salary") return employee.rate / periodsPerYear(frequency);
  const time = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
  return time.regular * employee.rate + time.overtime * employee.rate * 1.5 + time.vacation * employee.rate;
}

function calculateRow(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string): Row {
  const gross = grossFor(employee, timesheets, frequency);
  const ppy = periodsPerYear(frequency);
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
  return {
    ...employee,
    gross,
    incomeTax: result.deductions.incomeTaxCents / 100,
    cpp: result.deductions.cppCents / 100,
    cpp2: result.deductions.cpp2Cents / 100,
    ei: result.deductions.eiCents / 100,
    net: result.netPayCents / 100,
    employerCpp: result.employerContributions.cppCents / 100,
    employerEi: result.employerContributions.eiCents / 100,
  };
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
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled) {
            setState(payload.state);
            setProfile(payload.profile);
            setSource("Calculated from your synced UAT workspace");
          }
          return;
        }
      } catch {}
      try {
        const raw = window.localStorage.getItem(localStorageKey);
        if (raw && !cancelled) setState(JSON.parse(raw));
      } catch {}
      if (!cancelled) setSource("Calculated from UAT saved on this device");
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => profile.province === "Alberta" ? state.employees.map((employee) => calculateRow(employee, state.timesheets, profile.frequency)) : [], [state, profile]);
  const totals = useMemo(() => rows.reduce((t, row) => ({ gross: t.gross + row.gross, tax: t.tax + row.incomeTax, cpp: t.cpp + row.cpp + row.cpp2, ei: t.ei + row.ei, net: t.net + row.net, employerCpp: t.employerCpp + row.employerCpp, employerEi: t.employerEi + row.employerEi }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0, employerCpp: 0, employerEi: 0 }), [rows]);
  const cra = totals.tax + totals.cpp + totals.ei + totals.employerCpp + totals.employerEi;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · review</div></div></div>
          <div className="flex gap-2"><button onClick={() => router.push("/uat")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Edit UAT inputs</button><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-4 py-2 text-sm font-semibold text-white">Back to guided payroll</button></div>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Does this payroll look right?</h1><p className="mt-2 text-sm text-[#795f4f]">{profile.businessName} · {profile.frequency} · {source}</p></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${state.ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>{state.ready ? "Time ready" : "Time needs review"}</span></div>

          {profile.province !== "Alberta" ? <div className="mt-6 rounded-xl border border-[#e2b999] bg-[#fff6ec] p-4 text-sm text-[#714a32]">The current validated pilot calculation pack is Alberta-only.</div> : <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><Summary label="Gross pay" value={totals.gross} /><Summary label="Employee deposits" value={totals.net} /><Summary label="CRA obligation" value={cra} /></div>
            <div className="mt-7 overflow-x-auto rounded-2xl border border-[#e2d4c8] bg-white"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[#f8f0e8] text-xs uppercase tracking-wider text-[#806858]"><tr><th className="px-4 py-3">Employee</th><th>Input</th><th>Gross</th><th>Income tax</th><th>CPP</th><th>EI</th><th>Net pay</th></tr></thead><tbody>{rows.map((row) => { const time = state.timesheets[row.id]; return <tr key={row.id} className="border-t border-[#eee3da]"><td className="px-4 py-4 font-semibold">{row.name}<div className="mt-1 text-xs font-normal text-[#8a7364]">{row.status}</div></td><td>{row.payType === "Hourly" ? `${time?.regular ?? 0} reg · ${time?.overtime ?? 0} OT @ ${cad.format(row.rate)}/hr` : `${cad.format(row.rate)}/yr`}</td><td>{cad.format(row.gross)}</td><td>{cad.format(row.incomeTax)}</td><td>{cad.format(row.cpp + row.cpp2)}</td><td>{cad.format(row.ei)}</td><td className="font-semibold">{cad.format(row.net)}</td></tr>; })}</tbody></table></div>
            <div className="mt-5 rounded-xl border border-[#d4e7ca] bg-[#f5fbf1] p-4 text-sm text-[#3d5a2f]">Every hire, rate change and timesheet edit in UAT now feeds this calculation. Go back to UAT, change an input, and return here to see the payroll recalculate.</div>
          </>}
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[#e2d4c8] bg-white p-4"><div className="text-xs font-bold uppercase tracking-wider text-[#806858]">{label}</div><div className="mt-2 text-2xl font-semibold">{cad.format(value)}</div></div>;
}
