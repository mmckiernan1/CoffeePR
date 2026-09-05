"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarDays, Check, ChevronRight, Clock3, Landmark, LockKeyhole, ReceiptText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunPayrollShell } from "@/components/comcheq/run-payroll-shell";

export type GuidedPayrollEmployee = {
  name: string;
  payType: string;
  detail: string;
  netPay: number;
};

type GuidedPayrollRunProps = {
  approved: boolean;
  timeReady: boolean;
  employees: readonly GuidedPayrollEmployee[];
  gross: number;
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

type SavedProgress = {
  step: number;
  changesConfirmed: boolean;
  employeesConfirmed: boolean;
};

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });

export function GuidedPayrollRun({
  approved,
  timeReady,
  employees,
  gross,
  net,
  remittance,
  fee,
  onHome,
  onOpenEmployees,
  onOpenTime,
  onOpenReview,
  onApprove,
  onOpenPayments,
  onOpenReports,
  runKey = "run-17",
}: GuidedPayrollRunProps) {
  const [step, setStep] = useState(0);
  const [changesConfirmed, setChangesConfirmed] = useState(false);
  const [employeesConfirmed, setEmployeesConfirmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const storageKey = `coffee-payroll:guided-payroll:${runKey}`;
  const hourlyEmployees = useMemo(() => employees.filter((employee) => employee.payType.toLowerCase() === "hourly"), [employees]);
  const completedThrough = approved ? 4 : timeReady && employeesConfirmed && changesConfirmed ? 2 : employeesConfirmed && changesConfirmed ? 1 : changesConfirmed ? 0 : -1;
  const totalCash = net + remittance + fee;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedProgress>;
          if (typeof saved.step === "number") setStep(Math.min(Math.max(saved.step, 0), 5));
          if (typeof saved.changesConfirmed === "boolean") setChangesConfirmed(saved.changesConfirmed);
          if (typeof saved.employeesConfirmed === "boolean") setEmployeesConfirmed(saved.employeesConfirmed);
        }
      } catch {
        // Progress persistence is a convenience only; payroll state remains authoritative elsewhere.
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ step, changesConfirmed, employeesConfirmed }));
    } catch {
      // Keep navigation usable even when browser storage is unavailable.
    }
  }, [step, changesConfirmed, employeesConfirmed, hydrated, storageKey]);

  function saveProgress(progress: SavedProgress) {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      // Keep navigation usable even when browser storage is unavailable.
    }
  }

  function go(next: number) {
    const safeNext = Math.min(Math.max(next, 0), 5);
    setStep(safeNext);
  }

  function openEmployeeChanges() {
    const progress = { step: 0, changesConfirmed: true, employeesConfirmed };
    setChangesConfirmed(true);
    saveProgress(progress);
    onOpenEmployees();
  }

  function openEmployeesFromRoster() {
    saveProgress({ step: 1, changesConfirmed, employeesConfirmed });
    onOpenEmployees();
  }

  function openTimeEntry() {
    saveProgress({ step: 2, changesConfirmed, employeesConfirmed });
    onOpenTime();
  }

  function openReview() {
    saveProgress({ step: 3, changesConfirmed, employeesConfirmed });
    onOpenReview();
  }

  function openPayments() {
    saveProgress({ step: 4, changesConfirmed, employeesConfirmed });
    onOpenPayments();
  }

  return (
    <RunPayrollShell
      currentStep={step}
      completedThrough={completedThrough}
      onStepChange={go}
      onBack={() => go(step - 1)}
      onHome={onHome}
      title={step === 0 ? "Anything changed?" : undefined}
      detail={step === 0 ? "Tell Coffee Payroll what is different this pay period. If nothing changed, you can keep moving." : undefined}
    >
      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <button type="button" onClick={() => { setChangesConfirmed(true); go(1); }} className="group rounded-2xl border border-[#c9d5e6] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#f7f9fd]">
            <span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Check className="size-5" /></span>
            <h2 className="mt-4 text-lg font-semibold text-[#172033]">No changes this pay</h2>
            <p className="mt-1 text-sm leading-6 text-[#647087]">Everyone is still active and their regular pay setup is unchanged.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">Continue <ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span>
          </button>
          <button type="button" onClick={openEmployeeChanges} className="group rounded-2xl border border-[#c9d5e6] bg-white p-5 text-left transition hover:border-[#8fb0e8] hover:bg-[#f7f9fd]">
            <span className="grid size-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Users className="size-5" /></span>
            <h2 className="mt-4 text-lg font-semibold text-[#172033]">Yes, something changed</h2>
            <p className="mt-1 text-sm leading-6 text-[#647087]">New hire, leave, termination, pay-rate change, bonus or another employee change.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1557d8]">Review changes <ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span>
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-[#172033]">Who are you paying?</h2><p className="mt-1 text-sm text-[#647087]">A quick check before entering this period&apos;s pay.</p></div>
            <Button type="button" variant="outline" onClick={openEmployeesFromRoster} className="border-[#c9d5e6] bg-white text-[#17428e]">Manage employees</Button>
          </div>
          <div className="divide-y divide-[#e5ebf4] overflow-hidden rounded-2xl border border-[#dce4f0] bg-white">
            {employees.map((employee) => (
              <div key={employee.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#172033]">{employee.name}</strong>{employee.payType.toLowerCase() === "hourly" && <Badge className="border-0 bg-[#fff6df] text-[#725a22]">Hourly · hours needed</Badge>}</div><p className="mt-1 text-xs text-[#647087]">{employee.detail}</p></div>
                <Badge className="w-fit border-0 bg-[#eef9e8] text-[#34701d]">Included</Badge>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end"><Button type="button" onClick={() => { setEmployeesConfirmed(true); go(2); }} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Everyone looks right <ChevronRight className="size-4" /></Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><Clock3 className="size-5" /></span><div><h2 className="text-xl font-semibold text-[#172033]">Enter this pay</h2><p className="mt-1 text-sm leading-6 text-[#647087]">Salaried employees carry forward automatically. Enter hours or one-time pay only where needed.</p></div></div>
            <div className="mt-5 space-y-3">{hourlyEmployees.map((employee) => <button key={employee.name} type="button" onClick={openTimeEntry} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#dce4f0] bg-white p-4 text-left transition hover:border-[#8fb0e8] hover:bg-[#f7f9fd]"><span><strong className="block text-sm">{employee.name}</strong><span className="mt-1 block text-xs text-[#647087]">{employee.detail}</span></span><span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1557d8]">Enter hours <ChevronRight className="size-4" /></span></button>)}</div>
            <div className="mt-5 flex justify-end"><Button type="button" disabled={!timeReady} onClick={() => go(3)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5] disabled:bg-[#aebbd0]">{timeReady ? "Hours and pay are ready" : "Finish hours to continue"}<ChevronRight className="size-4" /></Button></div>
          </div>
          <aside className="rounded-2xl border border-[#dce4f0] bg-[#f7f9fd] p-4"><CalendarDays className="size-5 text-[#1557d8]" /><h3 className="mt-3 text-sm font-semibold">Coffee Payroll handles the routine</h3><p className="mt-2 text-xs leading-5 text-[#647087]">Regular salary, recurring deductions and configured statutory rules continue automatically unless something changed.</p></aside>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-semibold text-[#172033]">Does this payroll look right?</h2><p className="mt-1 text-sm text-[#647087]">Review the important numbers before anything is locked.</p></div><Button type="button" variant="outline" onClick={openReview} className="border-[#c9d5e6] bg-white text-[#17428e]">See payroll details</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><Summary label="Gross pay" value={gross} /><Summary label="Employee deposits" value={net} accent /><Summary label="CRA obligation" value={remittance} /></div>
          <div className="mt-5 rounded-xl border border-[#d4e7ca] bg-[#f5fbf1] p-4"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#4d8531]" /><div><h3 className="text-sm font-semibold text-[#294d1a]">Ready for your approval</h3><p className="mt-1 text-xs leading-5 text-[#537145]">Coffee Payroll has calculated the run. Nothing is finalized until you approve it.</p></div></div></div>
          <div className="mt-5 flex justify-end"><Button type="button" onClick={() => go(4)} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Looks good <ChevronRight className="size-4" /></Button></div>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557d8]"><LockKeyhole className="size-5" /></span><div><h2 className="text-xl font-semibold text-[#172033]">Approve and pay</h2><p className="mt-1 text-sm leading-6 text-[#647087]">This is the deliberate final step. Approval locks the payroll record and opens employee payment.</p></div></div>
            {!approved ? <Button type="button" onClick={onApprove} className="mt-6 bg-[#1557d8] text-white hover:bg-[#0f47b5]"><LockKeyhole className="size-4" />Approve payroll</Button> : <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={openPayments} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]"><Landmark className="size-4" />Pay employees</Button><Button type="button" variant="outline" onClick={() => go(5)} className="border-[#c9d5e6] bg-white text-[#17428e]">Continue when paid <ChevronRight className="size-4" /></Button></div>}
          </div>
          <aside className="rounded-2xl border border-[#dce4f0] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#647087]">Cash required</p><p className="mt-2 font-mono text-2xl font-bold text-[#172033]">{cad.format(totalCash)}</p><div className="mt-4 space-y-2 text-xs text-[#647087]"><Line label="Employee deposits" value={net} /><Line label="CRA obligation" value={remittance} /><Line label="Coffee Payroll fee" value={fee} /></div></aside>
        </div>
      )}

      {step === 5 && (
        <div className="py-2 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#eef9e8] text-[#34701d]"><Check className="size-8" /></span><h2 className="mt-5 text-2xl font-semibold text-[#172033]">You did your payroll.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#647087]">Run 17 is approved. Employee payments, CRA amounts and payroll records are together and ready for follow-up.</p><div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3"><Summary label="Employees" textValue={String(employees.length)} /><Summary label="Deposits" value={net} accent /><Summary label="CRA" value={remittance} /></div><div className="mt-6 flex flex-wrap justify-center gap-3"><Button type="button" variant="outline" onClick={onOpenReports} className="border-[#c9d5e6] bg-white text-[#17428e]"><ReceiptText className="size-4" />Reports & statements</Button><Button type="button" onClick={onHome} className="bg-[#1557d8] text-white hover:bg-[#0f47b5]">Back to main menu</Button></div></div>
      )}
    </RunPayrollShell>
  );
}

function Summary({ label, value, textValue, accent = false }: { label: string; value?: number; textValue?: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? "border-[#b9cef2] bg-[#edf3ff]" : "border-[#dce4f0] bg-white"}`}><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#647087]">{label}</p><p className={`mt-2 font-mono text-xl font-bold ${accent ? "text-[#1557d8]" : "text-[#172033]"}`}>{textValue ?? cad.format(value ?? 0)}</p></div>;
}

function Line({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="font-mono text-[#172033]">{cad.format(value)}</strong></div>;
}
