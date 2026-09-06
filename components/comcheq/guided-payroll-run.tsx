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
  onOpenEmployees: () => void;
  onOpenTime: () => void;
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
  return { isNew, isLeaving, needsAttention, changeLabel };
}

export function GuidedPayrollRun({ approved, paymentsComplete, timeReady, employees, net, remittance, fee, onHome, onOpenEmployees, onOpenTime, onOpenReview, onApprove, onOpenPayments, onOpenReports, runKey = "run-17" }: Props) {
  const [step, setStep] = useState(0);
  const [changesConfirmed, setChangesConfirmed] = useState(false);
  const [employeesConfirmed, setEmployeesConfirmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `coffee-payroll:guided-payroll:${runKey}`;
  const hourlyEmployees = useMemo(() => employees.filter((employee) => employee.payType.toLowerCase() === "hourly"), [employees]);
  const salariedCount = employees.length - hourlyEmployees.length;
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
  function openEmployeeChanges() { const progress = { step: 0, changesConfirmed: true, employeesConfirmed }; setChangesConfirmed(true); saveProgress(progress); onOpenEmployees(); }
  function openEmployeesFromRoster() { saveProgress({ step: 1, changesConfirmed, employeesConfirmed }); onOpenEmployees(); }
  function openTimeEntry() { saveProgress({ step: 2, changesConfirmed, employeesConfirmed }); onOpenTime(); }
  function openReview() { saveProgress({ step: 3, changesConfirmed, employeesConfirmed }); onOpenReview(); }
  function openPayments() { saveProgress({ step: 4, changesConfirmed, employeesConfirmed }); onOpenPayments(); }

  return (
    <RunPayrollShell currentStep={visibleStep} completedThrough={completedThrough} onStepChange={go} onBack={() => go(visibleStep - 1)} onHome={onHome} title={visibleStep === 0 ? "Anything changed?" : undefined} detail={visibleStep === 0 ? "Tell Coffee Payroll what is different this pay period. If nothing changed, you can keep moving." : undefined}>
      {visibleStep === 0 && <div className="grid gap-4 lg:grid-cols-2">
        <button type="button" onClick={() => { setChangesConfirmed(true); go(1); }} className="group rounded-2xl border border-[#c9d5e6] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#f7f9fd]"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Check className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-[#172033]">No changes this pay</h2><p className="mt-1 text-sm leading-6 text-[#647087]">Everyone is still active and their regular pay setup is unchanged.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">Continue <ChevronRight className="size-4" /></span></button>
        <button type="button" onClick={openEmployeeChanges} className="group rounded-2xl border border-[#c9d5e6] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#f7f9fd]"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Users className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-[#172033]">Yes, something changed</h2><p className="mt-1 text-sm leading-6 text-[#647087]">New hire, someone leaving, pay change, bonus or another employee change.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">Review changes <ChevronRight className="size-4" /></span></button>
      </div>}

      {visibleStep === 1 && <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#647087]">Step 2 · Employees</p><h2 className="mt-1 text-2xl font-semibold text-[#172033]">Here&apos;s who we&apos;re paying this time</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#647087]">Coffee Payroll carried forward your regular employee list. Check anyone with a change, then confirm the group.</p></div><Button type="button" variant="ghost" onClick={openEmployeesFromRoster} className="h-9 px-3 text-xs text-[#647087]">Edit employees</Button></div>
        {attentionEmployees.length > 0 && <p className="mb-4 text-xs text-[#7a604f]">{attentionEmployees.length} employee {attentionEmployees.length === 1 ? "has" : "have"} something to review. Click the highlighted card to open the employee details.</p>}
        <div className="grid gap-3 md:grid-cols-2">{employees.map((employee) => { const cue = employeeCue(employee); const isHourly = employee.payType.toLowerCase() === "hourly"; const content = <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#172033]">{employee.name}</strong>{isHourly && <span className="text-[11px] font-medium text-[#8a725f]">Hourly</span>}{cue.isNew && <Badge className="border-0 bg-[#eaf2ff] text-[#225caa]"><UserPlus className="mr-1 size-3" />New hire</Badge>}{cue.isLeaving && <Badge className="border-0 bg-[#fff0e5] text-[#9a5127]">Leaving</Badge>}</div><p className="mt-2 text-xs leading-5 text-[#647087]">{employee.detail}</p></div>{cue.needsAttention ? <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9a7b66]" /> : <span className="shrink-0 text-[11px] font-medium text-[#6f8a62]">Ready</span>}</div>{cue.changeLabel && <div className="mt-3 flex items-center gap-2 border-t border-[#eadfd4] pt-3 text-xs text-[#7a4a24]"><span className="size-1.5 rounded-full bg-[#c98d5b]" /><span className="font-medium">{cue.changeLabel}</span></div>}</>; const cls = cue.needsAttention ? "border-[#d9c1ab] bg-[#fffdf9] hover:border-[#bd916d] hover:bg-[#fffaf4] hover:shadow-sm" : "border-[#dce4f0] bg-white"; return cue.needsAttention ? <button key={employee.id ?? employee.name} type="button" onClick={openEmployeesFromRoster} className={`rounded-2xl border p-4 text-left transition ${cls}`}>{content}</button> : <div key={employee.id ?? employee.name} className={`rounded-2xl border p-4 ${cls}`}>{content}</div>; })}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5"><p className="text-xs text-[#647087]">{employees.length} employee{employees.length === 1 ? "" : "s"} included in this payroll.</p><Button type="button" onClick={() => { setEmployeesConfirmed(true); go(2); }} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Yes, this looks right <ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 2 && <div>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#647087]">Step 3 · Hours & pay</p><h2 className="mt-1 text-2xl font-semibold text-[#172033]">{hourlyEmployees.length === 0 ? "Your regular pay is ready" : `${hourlyEmployees.length} ${hourlyEmployees.length === 1 ? "employee needs" : "employees need"} hours`}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#647087]">{salariedCount > 0 ? `${salariedCount} salaried ${salariedCount === 1 ? "employee carries" : "employees carry"} forward automatically. ` : ""}{hourlyEmployees.length > 0 ? "Open each hourly employee below to enter or confirm this pay period." : "There is nothing to enter here unless you need to make an exception."}</p></div><span className={`text-xs font-medium ${timeReady ? "text-[#6f8a62]" : "text-[#8a725f]"}`}>{timeReady ? "Ready" : "Waiting for hours"}</span></div>
        {hourlyEmployees.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2">{hourlyEmployees.map((employee) => <button key={employee.id ?? employee.name} type="button" onClick={openTimeEntry} className="group rounded-2xl border border-[#dce4f0] bg-white p-4 text-left transition hover:border-[#9fb5d6] hover:bg-[#fbfcff] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-sm text-[#172033]">{employee.name}</strong><span className="text-[11px] font-medium text-[#8a725f]">Hourly</span></div><p className="mt-2 text-xs leading-5 text-[#647087]">{employee.detail}</p></div><ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9aa7b8] transition group-hover:text-[#1557d8]" /></div><div className="mt-3 text-xs font-medium text-[#1557d8]">{timeReady ? "Review entered hours" : "Enter hours"}</div></button>)}</div>}
        {salariedCount > 0 && <p className="mt-4 text-xs text-[#71806b]">✓ Regular salary for {salariedCount} salaried employee{salariedCount === 1 ? "" : "s"} is already included.</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5">{hourlyEmployees.length > 0 ? <Button type="button" variant="ghost" onClick={openTimeEntry} className="px-2 text-xs text-[#647087]">View all hours</Button> : <span className="text-xs text-[#647087]">No hourly entry required.</span>}<Button type="button" disabled={!timeReady} onClick={() => go(3)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5] disabled:bg-[#aebbd0]">{timeReady ? "Continue to review" : "Enter hours to continue"}<ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 3 && <div>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#647087]">Step 4 · Review</p><h2 className="mt-1 text-2xl font-semibold text-[#172033]">Here&apos;s your payroll</h2><p className="mt-1 text-sm text-[#647087]">Three quick checks before approval.</p></div><Button type="button" variant="ghost" onClick={openReview} className="h-9 px-3 text-xs text-[#647087]">See calculation detail</Button></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#dce4f0] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#647087]">Who am I paying?</p><p className="mt-2 text-3xl font-semibold text-[#172033]">{employees.length}</p><p className="mt-1 text-sm text-[#647087]">employee{employees.length === 1 ? "" : "s"} in this payroll</p><div className="mt-4 space-y-2">{employees.slice(0, 4).map((employee) => <div key={employee.id ?? employee.name} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{employee.name}</span><strong>{cad.format(employee.netPay)}</strong></div>)}</div></div>
          <div className="rounded-2xl border border-[#b9cef2] bg-[#edf3ff] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d7190]">How much should I have ready?</p><p className="mt-2 font-mono text-3xl font-bold text-[#1557d8]">{cad.format(totalCash)}</p><div className="mt-4 space-y-2 text-xs text-[#647087]"><Line label="Employee deposits" value={net} /><Line label="CRA obligation" value={remittance} /><Line label="Coffee Payroll fee" value={fee} /></div></div>
          <div className={`rounded-2xl border p-5 ${attentionEmployees.length > 0 ? "border-[#ead1b6] bg-[#fff8ee]" : "border-[#d4e7ca] bg-[#f5fbf1]"}`}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#647087]">Anything unusual?</p><p className="mt-2 text-3xl font-semibold text-[#172033]">{attentionEmployees.length}</p><p className="mt-1 text-sm text-[#647087]">employee{attentionEmployees.length === 1 ? "" : "s"} with a change to review</p>{attentionEmployees.length === 0 ? <div className="mt-4 flex items-start gap-2 text-sm text-[#4f6944]"><BadgeCheck className="mt-0.5 size-4 shrink-0" /><span>Nothing unusual is flagged.</span></div> : <button type="button" onClick={openReview} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#7a4a24]">Review the changes <ChevronRight className="size-4" /></button>}</div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf2] pt-5"><p className="text-xs text-[#647087]">Detailed tax, CPP and EI calculations are available one click deeper.</p><Button type="button" onClick={() => go(4)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Yes, this payroll looks right <ChevronRight className="size-4" /></Button></div>
      </div>}

      {visibleStep === 4 && <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><LockKeyhole className="size-5" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#647087]">Step 5 · Approve & pay</p><h2 className="mt-1 text-2xl font-semibold text-[#172033]">{approved ? "Payroll approved. Now pay your employees." : "Approve this payroll"}</h2><p className="mt-1 text-sm leading-6 text-[#647087]">{approved ? "Coffee Payroll will take you through each business e-transfer and record your confirmation. Payroll is not Done until every employee payment is confirmed." : "Approval deliberately locks this version of the payroll. If payroll inputs change later, you will need to review and approve the updated version again."}</p></div></div>
          {!approved ? <Button type="button" onClick={onApprove} className="mt-6 bg-[#1557d8] text-white hover:bg-[#0f47b5]"><LockKeyhole className="size-4" />Approve payroll</Button> : <div className="mt-6"><div className="mb-4 rounded-xl border border-[#d4e7ca] bg-[#f5fbf1] px-4 py-3 text-sm text-[#3d5a2f]"><strong>✓ Payroll approved.</strong> The next required action is to send and confirm the employee e-transfers.</div><Button type="button" onClick={openPayments} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]"><Landmark className="size-4" />Send & confirm employee payments <ChevronRight className="size-4" /></Button></div>}
        </div>
        <aside className="rounded-2xl border border-[#dce4f0] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#647087]">Cash required</p><p className="mt-2 font-mono text-2xl font-bold text-[#172033]">{cad.format(totalCash)}</p><div className="mt-4 space-y-2 text-xs text-[#647087]"><Line label="Employee deposits" value={net} /><Line label="CRA obligation" value={remittance} /><Line label="Coffee Payroll fee" value={fee} /></div><p className="mt-4 border-t border-[#e6ebf2] pt-4 text-xs leading-5 text-[#647087]">Coffee Payroll records the payment checklist. You remain in control of the actual business-bank e-transfers.</p></aside>
      </div>}

      {visibleStep === 5 && paymentsComplete && <div className="py-2 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#eef9e8] text-[#34701d]"><Check className="size-8" /></span><h2 className="mt-5 text-2xl font-semibold text-[#172033]">You did your payroll.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#647087]">Run 17 is approved and every employee payment has been confirmed. Your payroll is complete.</p><div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3"><Summary label="Employees" textValue={String(employees.length)} /><Summary label="Deposits" value={net} accent /><Summary label="CRA" value={remittance} /></div><div className="mt-6 flex flex-wrap justify-center gap-3"><Button type="button" variant="outline" onClick={onOpenReports} className="border-[#c9d5e6] bg-white text-[#17428e]"><ReceiptText className="size-4" />Reports & statements</Button><Button type="button" onClick={onHome} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Back to main menu</Button></div></div>}
    </RunPayrollShell>
  );
}

function Summary({ label, value, textValue, accent = false }: { label: string; value?: number; textValue?: string; accent?: boolean }) { return <div className={`rounded-xl border p-4 ${accent ? "border-[#b9cef2] bg-[#edf3ff]" : "border-[#dce4f0] bg-white"}`}><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#647087]">{label}</p><p className={`mt-2 font-mono text-xl font-bold ${accent ? "text-[#1557d8]" : "text-[#172033]"}`}>{textValue ?? cad.format(value ?? 0)}</p></div>; }
function Line({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="font-mono text-[#172033]">{cad.format(value)}</strong></div>; }
