"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, ChevronRight, Landmark, LockKeyhole, ReceiptText, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunPayrollShell } from "@/components/comcheq/run-payroll-shell";

export type GuidedPayrollEmployee = {
  id?: string;
  name: string;
  payType: string;
  detail: string;
  netPay: number;
  grossPay?: number;
  status?: "Active" | "New hire" | "Terminating" | "Terminated";
  changeLabel?: string;
  needsAttention?: boolean;
};

type Props = {
  approved: boolean;
  paymentsComplete: boolean;
  timeReady: boolean;
  employees: readonly GuidedPayrollEmployee[];
  net: number;
  remittance: number;
  fee: number;
  onHome: () => void;
  onOpenEmployees: (employee?: GuidedPayrollEmployee) => void;
  onOpenTime: (employee?: GuidedPayrollEmployee) => void;
  onOpenReview: () => void;
  onApprove: () => void;
  onOpenPayments: () => void;
  onOpenReports: () => void;
  runKey?: string;
};

type SavedProgress = { step: number; changesConfirmed: boolean; employeesConfirmed: boolean };
const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });

function employeeCue(employee: GuidedPayrollEmployee) {
  const detail = employee.detail.toLowerCase();
  const isNew = employee.status === "New hire" || detail.includes("new hire");
  const isLeaving = employee.status === "Terminating" || employee.status === "Terminated" || detail.includes("final pay") || detail.includes("last day");
  const hasPayChange = detail.includes("pay changed");
  const hasExtraPay = detail.includes("extra pay");
  const hasReviewNote = detail.includes("review note:");
  const needsAttention = employee.needsAttention ?? (isNew || isLeaving || hasPayChange || hasExtraPay || hasReviewNote);
  const changeLabel = employee.changeLabel ?? (isLeaving ? "Leaving this payroll" : isNew ? "New this payroll" : hasPayChange ? "Pay changed" : hasExtraPay ? "Extra pay added" : hasReviewNote ? "Review note" : undefined);
  return { isNew, isLeaving, hasPayChange, needsAttention, changeLabel };
}

export function GuidedPayrollRun({ approved, paymentsComplete, timeReady, employees, net, remittance, fee, onHome, onOpenEmployees, onOpenTime, onOpenReview, onApprove, onOpenPayments, onOpenReports, runKey = "run-17" }: Props) {
  const [step, setStep] = useState(0);
  const [changesConfirmed, setChangesConfirmed] = useState(false);
  const [employeesConfirmed, setEmployeesConfirmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `coffee-payroll:guided-payroll:${runKey}`;
  const hourlyEmployees = useMemo(() => employees.filter((employee) => employee.payType.toLowerCase() === "hourly"), [employees]);
  const salariedCount = employees.length - hourlyEmployees.length;
  const salariedGross = employees.filter((employee) => employee.payType.toLowerCase() !== "hourly").reduce((sum, employee) => sum + (employee.grossPay ?? 0), 0);
  const hourlyRateChangeCount = useMemo(() => hourlyEmployees.filter((employee) => employeeCue(employee).hasPayChange).length, [hourlyEmployees]);
  const attentionEmployees = useMemo(() => employees.filter((employee) => employeeCue(employee).needsAttention), [employees]);
  const visibleStep = paymentsComplete ? 5 : step;
  const completedThrough = paymentsComplete ? 5 : approved ? 3 : timeReady && employeesConfirmed && changesConfirmed ? 2 : employeesConfirmed && changesConfirmed ? 1 : changesConfirmed ? 0 : -1;
  const totalCash = net + remittance + fee;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedProgress>;
          if (typeof saved.step === "number") setStep(Math.min(Math.max(saved.step, 0), 4));
          if (typeof saved.changesConfirmed === "boolean") setChangesConfirmed(saved.changesConfirmed);
          if (typeof saved.employeesConfirmed === "boolean") setEmployeesConfirmed(saved.employeesConfirmed);
        }
      } catch { /* convenience state only */ }
      setHydrated(true);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.sessionStorage.setItem(storageKey, JSON.stringify({ step, changesConfirmed, employeesConfirmed })); } catch { /* navigation stays usable */ }
  }, [step, changesConfirmed, employeesConfirmed, hydrated, storageKey]);

  function saveProgress(progress: SavedProgress) { try { window.sessionStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* navigation stays usable */ } }
  function go(next: number) {
    const maxStep = paymentsComplete ? 5 : 4;
    setStep(Math.min(Math.max(next, 0), maxStep));
  }
  function openEmployeeChanges() { const progress = { step: 1, changesConfirmed: true, employeesConfirmed }; setChangesConfirmed(true); saveProgress(progress); onOpenEmployees(); }
  function openEmployeesFromRoster(employee?: GuidedPayrollEmployee) { saveProgress({ step: 1, changesConfirmed, employeesConfirmed }); onOpenEmployees(employee); }
  function openTimeEntry(employee?: GuidedPayrollEmployee) { saveProgress({ step: 2, changesConfirmed, employeesConfirmed }); onOpenTime(employee); }
  function openReview() { saveProgress({ step: 3, changesConfirmed, employeesConfirmed }); onOpenReview(); }
  function openPayments() { saveProgress({ step: 4, changesConfirmed, employeesConfirmed }); onOpenPayments(); }
  // A routine employer can confirm the already-listed roster and changes in
  // one action, without dismissing two separate introductory screens.
  // This changes navigation only. Time, tax, rate-split and approval guards
  // remain enforced by the payroll workflow.
  function useQuickPayroll() {
    const next = timeReady ? 3 : 2;
    const progress = { step: next, changesConfirmed: true, employeesConfirmed: true };
    setChangesConfirmed(true);
    setEmployeesConfirmed(true);
    setStep(next);
    saveProgress(progress);
  }

  const recordedChangeCount = attentionEmployees.length;
  const changeTitle = recordedChangeCount > 0 ? "Changes this payroll" : "Anything changed?";
  const changeDetail = recordedChangeCount > 0
    ? `Coffee Payroll already has ${recordedChangeCount} employee ${recordedChangeCount === 1 ? "change" : "changes"} recorded. Add anything else, or keep moving.`
    : "Tell Coffee Payroll what is different this pay period. If nothing changed, you can keep moving.";

  return (
    <RunPayrollShell currentStep={visibleStep} completedThrough={completedThrough} onStepChange={go} onBack={() => go(visibleStep - 1)} onHome={onHome} title={visibleStep === 0 ? changeTitle : undefined} detail={visibleStep === 0 ? changeDetail : undefined}>
      {visibleStep === 0 && <>
        <section className="mb-5 rounded-2xl border border-[#d9c9b8] bg-[#fffaf5] p-5 sm:p-6" aria-label="Quick payroll">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#795f4f]">Quick payroll</p>
              <h2 className="mt-1 text-xl font-semibold text-[#332118]">{timeReady ? "Ready for your review" : hourlyEmployees.length ? `${hourlyEmployees.length} hourly ${hourlyEmployees.length === 1 ? "employee needs" : "employees need"} a check` : "Regular salary is ready"}</h2>
              <p className="mt-2 max-w-xl text-sm text-[#795f4f]">{salariedCount} salaried ${salariedCount === 1 ? "employee is" : "employees are"} calculated automatically. ${hourlyEmployees.length ? `${hourlyEmployees.length} hourly ${hourlyEmployees.length === 1 ? "employee" : "employees"} included.` : "No hourly hours to enter."} ${recordedChangeCount ? `${recordedChangeCount} existing employee ${recordedChangeCount === 1 ? "change" : "changes"} shown below.` : "No recorded employee changes."}</p>
            </div>
            <Button type="button" onClick={useQuickPayroll} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">
              {timeReady ? "Review payroll" : "Check hours & pay"} <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#795f4f]">
            <span className="rounded-full border border-[#decdbd] bg-white px-3 py-1.5">{employees.length} employees included</span>
            {salariedCount > 0 && <span className="rounded-full border border-[#d9e6d2] bg-[#f8fbf6] px-3 py-1.5">{salariedCount} salary ready · {cad.format(salariedGross)} gross</span>}
            {recordedChangeCount > 0 && <span className="rounded-full border border-[#e6c566] bg-[#fff6ec] px-3 py-1.5">{recordedChangeCount} changes to review</span>}
          </div>
          <p className="mt-3 text-xs text-[#795f4f]">Confirm the employee count and recorded changes. The full employee list is available below.</p>
        </section>
        {recordedChangeCount > 0 && <div className="mb-4 rounded-2xl border border-[#eadfd4] bg-[#fffdf9] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#795f4f]">Already recorded</p><div className="mt-3 space-y-2">{attentionEmployees.map((employee) => <div key={employee.id ?? employee.name} className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-[#332118]">{employee.name}</span><span className="text-xs text-[#795f4f]">{employeeCue(employee).changeLabel ?? "Review"}</span></div>)}</div></div>}
        <div className="grid gap-4 lg:grid-cols-2">
          <button type="button" onClick={() => { setChangesConfirmed(true); go(1); }} className="group rounded-2xl border border-[#decdbd] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#fffaf5]"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Check className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-[#332118]">{recordedChangeCount > 0 ? "No other changes" : "No changes this pay"}</h2><p className="mt-1 text-sm leading-6 text-[#795f4f]">{recordedChangeCount > 0 ? "Keep the changes already recorded and continue to the employee check." : "Everyone is still active and their regular pay setup is unchanged."}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">Continue <ChevronRight className="size-4" /></span></button>
          <button type="button" onClick={openEmployeeChanges} className="group rounded-2xl border border-[#decdbd] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#fffaf5]"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Users className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-[#332118]">{recordedChangeCount > 0 ? "Add another change" : "Yes, something changed"}</h2><p className="mt-1 text-sm leading-6 text-[#795f4f]">New hire, someone leaving, pay change, leave or another employee change.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">{recordedChangeCount > 0 ? "Add change" : "Review changes"} <ChevronRight className="size-4" /></span></button>
        </div>
      </>}

      {visibleStep === 1 && <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold text-[#332118]">Here&apos;s who we&apos;re paying this time</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#795f4f]">Coffee Payroll carried forward your regular employee list. Review anyone with a highlighted change, then confirm the group.</p></div><Button type="button" variant="ghost" onClick={openEmployeesFromRoster} className="h-9 px-3 text-xs text-[#795f4f]">Add or change employee</Button></div>
        {attentionEmployees.length > 0 && <p className="mb-4 text-xs text-[#795f4f]">{attentionEmployees.length} employee {attentionEmployees.length === 1 ? "has" : "have"} something to review. Highlighted cards show the change. Tap any other employee only if you need to make a change.</p>}
        <div className="grid gap-3 md:grid-cols-2">{employees.map((employee) => { const cue = employeeCue(employee); const isHourly = employee.payType.toLowerCase() === "hourly"; const content = <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#332118]">{employee.name}</strong>{employee.id && <span className="text-[11px] text-[#795f4f]">ID {employee.id}</span>}{isHourly && <span className="text-[11px] font-medium text-[#795f4f]">Hourly</span>}{cue.isNew && <Badge className="border-0 bg-[#eaf2ff] text-[#225caa]"><UserPlus className="mr-1 size-3" />New hire</Badge>}{cue.isLeaving && <Badge className="border-0 bg-[#fff6ec] text-[#714a32]">Leaving</Badge>}</div><p className="mt-2 text-xs leading-5 text-[#795f4f]">{employee.detail}</p>{!isHourly && typeof employee.grossPay === "number" && <p className="mt-2 text-xs font-semibold text-[#47623b]">This pay: {cad.format(employee.grossPay)} · No time entry required</p>}</div>{cue.needsAttention ? <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#795f4f]" /> : <div className="flex shrink-0 items-center gap-1.5"><span className="text-[11px] font-medium text-[#6f8a62]">Ready</span><ChevronRight className="size-4 text-[#9aa7b8] transition group-hover:text-[#1557d8]" /></div>}</div>{cue.changeLabel && <div className="mt-3 flex items-center gap-2 border-t border-[#eadfd4] pt-3 text-xs text-[#714a32]"><span className="size-1.5 rounded-full bg-[#b9cef2]" /><span className="font-medium">{cue.changeLabel}</span></div>}</>; const cls = cue.needsAttention ? "border-[#e5d1bd] bg-[#fffdf9] hover:border-[#9fb5d6] hover:bg-[#fffdf9] hover:shadow-sm" : "border-[#decdbd] bg-white hover:border-[#9fb5d6] hover:bg-[#fffaf5] hover:shadow-sm"; return <button key={employee.id ?? employee.name} type="button" onClick={() => openEmployeesFromRoster(employee)} className={`group rounded-2xl border p-4 text-left transition ${cls}`}>{content}</button>; })}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5"><p className="text-xs text-[#795f4f]">{employees.length} employee{employees.length === 1 ? "" : "s"} included in this payroll.</p><Button type="button" onClick={() => { setEmployeesConfirmed(true); go(2); }} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Yes, this looks right <ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 2 && <div>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-[#332118]">{timeReady ? "Hours and pay are ready" : hourlyEmployees.length === 0 ? "Your regular pay is ready" : hourlyRateChangeCount > 0 ? `${hourlyRateChangeCount} rate ${hourlyRateChangeCount === 1 ? "change needs" : "changes need"} a quick check` : `${hourlyEmployees.length} hourly ${hourlyEmployees.length === 1 ? "employee" : "employees"} to check`}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">{salariedCount > 0 ? `${salariedCount} salaried ${salariedCount === 1 ? "employee carries" : "employees carry"} forward automatically. ` : ""}{timeReady ? "Hourly entries have been confirmed. Continue to review the payroll." : hourlyRateChangeCount > 0 ? "The regular hourly entries are already here. Review the highlighted rate change, then confirm the hours." : hourlyEmployees.length > 0 ? "Review the hourly employees below and change only what is different this pay period." : "There is nothing to enter here unless you need to make an exception."}</p></div><span className={`text-xs font-medium ${timeReady ? "text-[#6f8a62]" : "text-[#795f4f]"}`}>{timeReady ? "Ready" : hourlyRateChangeCount > 0 ? "Rate check needed" : "Needs confirmation"}</span></div>
        {hourlyEmployees.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2">{hourlyEmployees.map((employee) => { const cue = employeeCue(employee); return <button key={employee.id ?? employee.name} type="button" onClick={() => openTimeEntry(employee)} className={`group rounded-2xl border p-4 text-left transition hover:shadow-sm ${cue.hasPayChange ? "border-[#e5d1bd] bg-[#fffdf9] hover:border-[#9fb5d6]" : "border-[#decdbd] bg-white hover:border-[#9fb5d6] hover:bg-[#fffaf5]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-sm text-[#332118]">{employee.name}</strong><span className="text-[11px] font-medium text-[#795f4f]">Hourly</span>{cue.hasPayChange && <span className="rounded-full bg-[#fff6ec] px-2 py-0.5 text-[10px] font-semibold text-[#714a32]">Rate changed</span>}</div><p className="mt-2 text-xs leading-5 text-[#795f4f]">{employee.detail}</p></div><ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9aa7b8] transition group-hover:text-[#1557d8]" /></div><div className="mt-3 text-xs font-medium text-[#1557d8]">{cue.hasPayChange ? "Review rate change" : timeReady ? "Review hours" : "Hours already entered"}</div></button>; })}</div>}
        {salariedCount > 0 && <div className="mt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#71806b]">Salary carried forward automatically</p><div className="grid gap-3 md:grid-cols-2">{employees.filter((employee) => employee.payType.toLowerCase() !== "hourly").map((employee) => <div key={employee.id ?? employee.name} className="rounded-2xl border border-[#d9e6d2] bg-[#f8fbf6] p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#332118]">{employee.name}</strong><p className="mt-1 text-xs text-[#795f4f]">No time entry required</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#71806b]">This pay</p><p className="mt-1 font-mono text-sm font-bold text-[#47623b]">{cad.format(employee.grossPay ?? 0)}</p></div></div></div>)}</div></div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5">{hourlyEmployees.length > 0 ? <Button type="button" variant="ghost" onClick={() => openTimeEntry()} className="px-2 text-xs text-[#795f4f]">View all hours</Button> : <span className="text-xs text-[#795f4f]">No hourly entry required.</span>}<Button type="button" disabled={!timeReady} onClick={() => go(3)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5] disabled:bg-[#aebbd0]">{timeReady ? "Continue to review" : "Review hours to continue"}<ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 3 && <div>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold text-[#332118]">Review before you approve</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#795f4f]">Confirm the cash required, scan the employee payments, and check anything that changed this pay.</p></div><Button type="button" variant="ghost" onClick={openReview} className="h-9 px-3 text-xs text-[#795f4f]">Calculation detail</Button></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-[#d9c9b8] bg-[#fffaf5] p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#795f4f]">Have this amount ready</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[-0.03em] text-[#1557d8]">{cad.format(totalCash)}</p>
            <p className="mt-2 text-sm text-[#795f4f]">This covers employee net pay, your CRA obligation and the Coffee Payroll fee.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><ReviewAmount label="Employee deposits" value={net} /><ReviewAmount label="CRA obligation" value={remittance} /><ReviewAmount label="Coffee Payroll fee" value={fee} /></div>
          </section>
          <section className="rounded-2xl border border-[#decdbd] bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#795f4f]">Anything changed?</p><p className="mt-2 text-lg font-semibold text-[#332118]">{attentionEmployees.length === 0 ? "No unusual changes" : `${attentionEmployees.length} ${attentionEmployees.length === 1 ? "employee has" : "employees have"} a change`}</p></div>{attentionEmployees.length === 0 && <BadgeCheck className="size-5 shrink-0 text-[#5f7d4e]" />}</div>
            <p className="mt-2 text-sm leading-6 text-[#795f4f]">{attentionEmployees.length === 0 ? "Your employee setup and pay inputs look routine for this run." : "Open the calculation detail if you want to inspect the changed employee before approving."}</p>
            {attentionEmployees.length > 0 && <div className="mt-4 space-y-2">{attentionEmployees.slice(0, 3).map((employee) => <div key={employee.id ?? employee.name} className="flex items-center justify-between gap-3 border-t border-[#f0e4d9] pt-2 text-sm first:border-t-0 first:pt-0"><span className="truncate text-[#795f4f]">{employee.name}</span><span className="text-xs text-[#795f4f]">{employeeCue(employee).changeLabel ?? "Review"}</span></div>)}<button type="button" onClick={openReview} className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[#1557d8]">Review changes <ChevronRight className="size-3.5" /></button></div>}
          </section>
        </div>
        <section className="mt-4 overflow-hidden rounded-2xl border border-[#decdbd] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#e6ebf2] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#795f4f]">Employee payments</p><p className="mt-1 text-sm text-[#795f4f]">Net pay that will be sent to each employee.</p></div><span className="text-xs font-medium text-[#795f4f]">{employees.length} employee{employees.length === 1 ? "" : "s"}</span></div>
          <div className="divide-y divide-[#f0e4d9]">{employees.map((employee) => <div key={employee.id ?? employee.name} className="flex items-center justify-between gap-4 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#332118]">{employee.name}</p><p className="mt-0.5 truncate text-xs text-[#795f4f]">{employee.payType}{employeeCue(employee).changeLabel ? ` · ${employeeCue(employee).changeLabel}` : ""}</p></div><strong className="shrink-0 font-mono text-sm text-[#332118]">{cad.format(employee.netPay)}</strong></div>)}</div>
        </section>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5"><Button type="button" variant="ghost" onClick={openReview} className="px-2 text-xs text-[#795f4f]">See tax, CPP and EI detail</Button><Button type="button" onClick={() => go(4)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Yes, this payroll looks right <ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 4 && <div>
        <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${approved ? "bg-[#eef9e8] text-[#5f7d4e]" : "bg-[#edf3ff] text-[#1557d8]"}`}>{approved ? <Check className="size-5" /> : <LockKeyhole className="size-5" />}</span><div><h2 className="text-2xl font-semibold text-[#332118]">{approved ? "Approved. Now pay your employees." : "Ready to approve"}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#795f4f]">{approved ? "Your reviewed payroll is approved. Paying employees is the next separate step, and Coffee Payroll will keep track as you confirm each payment." : "Approval confirms the payroll you just reviewed. It does not send any money. You will pay employees in the next step."}</p></div></div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-[#decdbd] bg-white p-5 sm:p-6">
            {!approved ? <>
              <p className="text-sm font-semibold text-[#332118]">You are approving:</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><ReviewAmount label="Employees" textValue={String(employees.length)} /><ReviewAmount label="Employee deposits" value={net} /><ReviewAmount label="Total cash required" value={totalCash} /></div>
              <p className="mt-4 text-xs leading-5 text-[#795f4f]">If you go back and change payroll inputs later, review the updated payroll again before approving it.</p>
              <Button type="button" onClick={onApprove} className="mt-5 bg-[#1557d8] text-white hover:bg-[#0f47b5]"><LockKeyhole className="size-4" />Approve this payroll</Button>
            </> : <>
              <div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#5f7d4e]" /><div><p className="font-semibold text-[#332118]">Payroll numbers approved</p><p className="mt-1 text-sm leading-6 text-[#795f4f]">Approval is separate from payment. Continue to the checklist to record each business e-transfer or cheque as you pay employees.</p></div></div>
              <Button type="button" onClick={openPayments} className="mt-5 bg-[#1557d8] text-white hover:bg-[#0f47b5]"><Landmark className="size-4" />Pay employees <ChevronRight className="size-4" /></Button>
            </>}
          </section>

          <aside className="rounded-2xl border border-[#decdbd] bg-[#fffaf5] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#795f4f]">What happens next</p><div className="mt-4 space-y-4 text-sm"><div className="flex gap-3"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${approved ? "bg-[#eef9e8] text-[#5f7d4e]" : "bg-[#1557d8] text-white"}`}>{approved ? <Check className="size-3.5" /> : "1"}</span><div><p className="font-semibold text-[#332118]">Approve payroll</p><p className="mt-0.5 text-xs leading-5 text-[#795f4f]">Confirm the numbers you reviewed.</p></div></div><div className="flex gap-3"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${approved ? "bg-[#1557d8] text-white" : "bg-[#f7efe6] text-[#7a8799]"}`}>2</span><div><p className="font-semibold text-[#332118]">Pay employees</p><p className="mt-0.5 text-xs leading-5 text-[#795f4f]">Send and confirm each employee payment.</p></div></div></div></aside>
        </div>
      </div>}

      {visibleStep === 5 && paymentsComplete && <div className="py-2 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#eef9e8] text-[#34701d]"><Check className="size-8" /></span><h2 className="mt-5 text-2xl font-semibold text-[#332118]">You did your payroll.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#795f4f]">Run 18 is approved and every employee payment has been confirmed. Your payroll is complete.</p><div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3"><Summary label="Employees" textValue={String(employees.length)} /><Summary label="Deposits" value={net} accent /><Summary label="CRA" value={remittance} /></div><div className="mt-6 flex flex-wrap justify-center gap-3"><Button type="button" variant="outline" onClick={onOpenReports} className="border-[#decdbd] bg-white text-[#1557d8]"><ReceiptText className="size-4" />Reports & statements</Button><Button type="button" onClick={onHome} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Back to main menu</Button></div></div>}
    </RunPayrollShell>
  );
}

function ReviewAmount({ label, value, textValue }: { label: string; value?: number; textValue?: string }) { return <div className="rounded-xl border border-[#e5d1bd] bg-white/80 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#795f4f]">{label}</p><p className="mt-1.5 font-mono text-sm font-bold text-[#332118]">{textValue ?? cad.format(value ?? 0)}</p></div>; }
function Summary({ label, value, textValue, accent = false }: { label: string; value?: number; textValue?: string; accent?: boolean }) { return <div className={`rounded-xl border p-4 ${accent ? "border-[#b9cef2] bg-[#edf3ff]" : "border-[#decdbd] bg-white"}`}><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#795f4f]">{label}</p><p className={`mt-2 font-mono text-xl font-bold ${accent ? "text-[#1557d8]" : "text-[#332118]"}`}>{textValue ?? cad.format(value ?? 0)}</p></div>; }
function Line({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="font-mono text-[#332118]">{cad.format(value)}</strong></div>; }
