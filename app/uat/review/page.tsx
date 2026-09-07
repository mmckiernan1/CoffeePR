"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pilotHourlyRateSplitDetails } from "@/lib/payroll/pilot-hourly-rate-split";
import {
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotCalculateEmployee,
  pilotChangeSummary,
  pilotEmployeeIsInRun,
  pilotExtraTaxablePayDollars,
  pilotFinalPayDollars,
  type PilotProfile,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default function UatReviewPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [source, setSource] = useState("Loading UAT workspace…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) { const payload = await response.json(); if (!cancelled) { setState(payload.state); setProfile(payload.profile); setSource("Synced UAT workspace"); } return; }
      } catch { /* device fallback */ }
      try { const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY); if (raw && !cancelled) setState(JSON.parse(raw)); } catch { /* starter data */ }
      if (!cancelled) setSource("Saved on this device");
    })();
    return () => { cancelled = true; };
  }, []);

  const includedEmployees = useMemo(() => state.employees.filter(pilotEmployeeIsInRun), [state.employees]);
  const unusualEmployees = useMemo(() => includedEmployees.filter((employee) => pilotChangeSummary(employee, true)), [includedEmployees]);
  const excludedEmployees = useMemo(() => state.employees.filter((employee) => !pilotEmployeeIsInRun(employee)), [state.employees]);
  const rows = useMemo(() => profile.province === "Alberta" ? includedEmployees.map((employee) => pilotCalculateEmployee(employee, state.timesheets, profile.frequency, state.openingBalances ?? {})) : [], [includedEmployees, state.timesheets, state.openingBalances, profile]);
  const totals = useMemo(() => rows.reduce((t, row) => ({ gross: t.gross + row.gross, tax: t.tax + row.incomeTax, cpp: t.cpp + row.cpp + row.cpp2, ei: t.ei + row.ei, net: t.net + row.net, employerCpp: t.employerCpp + row.employerCpp, employerEi: t.employerEi + row.employerEi }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0, employerCpp: 0, employerEi: 0 }), [rows]);
  const cra = totals.tax + totals.cpp + totals.ei + totals.employerCpp + totals.employerEi;
  const payrollFee = 18;
  const totalFunding = totals.net + cra + payrollFee;
  const openingBalanceCount = Object.keys(state.openingBalances ?? {}).length;
  const splitRateCount = includedEmployees.filter((employee) => employee.payType === "Hourly" && (state.timesheets[employee.id]?.rateSplits?.length ?? 0) > 1).length;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · review</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 4 · Review</p><h1 className="mt-2 text-3xl font-semibold">Here&apos;s your payroll</h1><p className="mt-2 text-sm text-[#795f4f]">{profile.businessName} · Run 17 · August 16–31 · Pay September 4, 2026 · {source}</p>{openingBalanceCount > 0 && <p className="mt-1 text-xs font-semibold text-[#55769e]">Using saved opening balances for {openingBalanceCount} employee{openingBalanceCount === 1 ? "" : "s"}.</p>}</div>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${state.ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>{state.ready ? "✓ Hours ready" : "Hours need review"}</span>
          </div>

          {profile.province !== "Alberta" ? <div className="mt-6 rounded-xl border border-[#e2b999] bg-[#fff6ec] p-4 text-sm text-[#714a32]">The current validated pilot calculation pack is Alberta-only.</div> : <>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#e2d4c8] bg-white p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Who you&apos;re paying</div><div className="mt-2 text-3xl font-semibold">{rows.length}</div><div className="mt-1 text-sm text-[#795f4f]">employee{rows.length === 1 ? "" : "s"} in this payroll</div><div className="mt-4 space-y-2 text-sm">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3"><span className="truncate">{row.name}</span><strong>{cad.format(row.net)}</strong></div>)}</div></div>
              <div className="rounded-2xl border border-[#c9d9ef] bg-[#f7fbff] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#55769e]">Money to have ready</div><div className="mt-2 text-3xl font-semibold text-[#244f78]">{cad.format(totalFunding)}</div><div className="mt-4 space-y-2 text-sm text-[#55708a]"><div className="flex justify-between gap-3"><span>Employee e-transfers</span><strong>{cad.format(totals.net)}</strong></div><div className="flex justify-between gap-3"><span>CRA obligation</span><strong>{cad.format(cra)}</strong></div><div className="flex justify-between gap-3"><span>Coffee Payroll fee</span><strong>{cad.format(payrollFee)}</strong></div></div><p className="mt-4 text-xs leading-5 text-[#6b8197]">Employee e-transfers are the immediate bank payments in this pilot. CRA remains an obligation until remitted.</p></div>
              <div className={`rounded-2xl border p-5 ${unusualEmployees.length > 0 ? "border-[#e3c39f] bg-[#fff8ee]" : "border-[#d7e5ce] bg-[#f7fbf4]"}`}><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Anything unusual?</div><div className="mt-2 text-3xl font-semibold">{unusualEmployees.length}</div><div className="mt-1 text-sm text-[#795f4f]">employee{unusualEmployees.length === 1 ? "" : "s"} with a change to review</div>{unusualEmployees.length === 0 ? <p className="mt-4 text-sm text-[#4f6944]">Nothing unusual is flagged. Regular payroll carried forward as expected.</p> : <div className="mt-4 space-y-2">{unusualEmployees.map((employee) => <button key={employee.id} onClick={() => router.push("/uat/lifecycle")} className="w-full rounded-xl bg-white/80 px-3 py-2.5 text-left text-sm"><strong>{employee.name}</strong><div className="mt-1 text-xs leading-5 text-[#795f4f]">{pilotChangeSummary(employee, true)}</div></button>)}</div>}</div>
            </div>

            {splitRateCount > 0 && <div className="mt-4 rounded-xl border border-[#c9d9ef] bg-[#f7fbff] p-4 text-sm text-[#466985]"><strong>{splitRateCount} hourly employee{splitRateCount === 1 ? " has" : "s have"} a rate change inside this pay period.</strong><p className="mt-1 text-xs leading-5">Coffee Payroll used the hours you allocated to each effective rate. The calculation detail below shows each rate separately so you can see exactly how gross pay was built.</p></div>}
            {excludedEmployees.length > 0 && <div className="mt-4 rounded-xl border border-[#d9d5cf] bg-[#f8f6f3] p-4 text-sm text-[#675b52]">{excludedEmployees.length} employee{excludedEmployees.length === 1 ? " is" : "s are"} outside this pay period and excluded from the run.</div>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-4"><div><strong className="text-sm text-[#3d5a2f]">The important checks are above.</strong><p className="mt-1 text-xs leading-5 text-[#5f7654]">Open the calculation detail only if you want to inspect gross, tax, CPP, EI or final-pay components employee by employee.</p></div><button onClick={() => document.getElementById("calculation-detail")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-[#c9d8bf] bg-white px-4 py-2 text-sm font-semibold text-[#48613b]">See calculation detail</button></div>

            <div id="calculation-detail" className="mt-7 overflow-x-auto rounded-2xl border border-[#e2d4c8] bg-white"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-[#f8f0e8] text-xs uppercase tracking-wider text-[#806858]"><tr><th className="px-4 py-3">Employee</th><th>Input</th><th>Gross</th><th>Extra / final pay</th><th>Income tax</th><th>CPP</th><th>EI</th><th>Net pay</th></tr></thead><tbody>{rows.map((row) => { const time = state.timesheets[row.id]; const finalPay = pilotFinalPayDollars(row.finalPay); const finalTaxable = finalPay.vacationPay + finalPay.overtimePay + finalPay.otherTaxablePay; const extra = pilotExtraTaxablePayDollars(row) + finalTaxable; const reviewLabel = pilotChangeSummary(row, true); const splitDetails = row.payType === "Hourly" && time?.rateSplits && time.rateSplits.length > 1 ? pilotHourlyRateSplitDetails(row, time.rateSplits) : []; return <tr key={row.id} className={`border-t border-[#eee3da] ${reviewLabel ? "bg-[#fffaf2]" : ""}`}><td className="px-4 py-4 font-semibold">{row.name}<div className="mt-1 text-xs font-normal text-[#8a7364]">{reviewLabel || row.status}</div></td><td className="py-3 pr-4">{row.payType === "Hourly" ? splitDetails.length > 0 ? <div className="space-y-1.5">{splitDetails.map((split) => <div key={split.effectiveFrom} className="whitespace-nowrap"><span className="font-semibold">From {split.effectiveFrom}</span> · {split.regular} reg × {cad.format(split.rate)}{split.overtime > 0 ? ` · ${split.overtime} OT × ${cad.format(split.rate * 1.5)}` : ""}{split.vacation > 0 ? ` · ${split.vacation} vac × ${cad.format(split.rate)}` : ""}<span className="ml-2 text-xs text-[#806858]">= {cad.format(split.gross)}</span></div>)}</div> : `${time?.regular ?? 0} reg · ${time?.overtime ?? 0} OT @ ${cad.format(row.appliedRate)}/hr` : `${cad.format(row.appliedRate)}/yr`}</td><td>{cad.format(row.gross)}</td><td>{extra > 0 || row.reimbursement > 0 ? <span>{extra > 0 ? <strong>{cad.format(extra)} taxable</strong> : null}{row.reimbursement > 0 ? ` · ${cad.format(row.reimbursement)} reimb.` : ""}</span> : "—"}</td><td>{cad.format(row.incomeTax)}</td><td>{cad.format(row.cpp + row.cpp2)}</td><td>{cad.format(row.ei)}</td><td className="font-semibold">{cad.format(row.net)}</td></tr>; })}</tbody></table></div>

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[#eadfd4] pt-5"><button onClick={() => router.push("/uat/time")} className="rounded-xl border border-[#d6c6b8] bg-white px-4 py-2.5 text-sm font-semibold">Edit hours</button><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">This payroll looks right</button></div>
          </>}
        </section>
      </div>
    </main>
  );
}
