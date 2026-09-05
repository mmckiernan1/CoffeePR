"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  rateEffectiveDate?: string;
  terminationDate?: string;
  finalPay?: { vacationPay: number; overtimePay: number; otherTaxablePay: number; reimbursement: number };
};

type Timesheet = { regular: number; overtime: number; vacation: number };
type WorkspaceState = { employees: Employee[]; timesheets: Record<string, Timesheet>; ready: boolean };

export default function LifecycleUatPage() {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("2026-09-01");
  const [newRate, setNewRate] = useState("");
  const [terminationDate, setTerminationDate] = useState("2026-08-31");
  const [vacationPay, setVacationPay] = useState("0");
  const [overtimePay, setOvertimePay] = useState("0");
  const [otherTaxablePay, setOtherTaxablePay] = useState("0");
  const [reimbursement, setReimbursement] = useState("0");
  const [notice, setNotice] = useState("Loading employee lifecycle data…");

  const selected = useMemo(() => state?.employees.find((employee) => employee.id === employeeId) ?? null, [employeeId, state]);

  useEffect(() => {
    fetch("/api/pilot/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sign in to use the persistent UAT workspace.");
        const payload = await response.json();
        setState(payload.state);
        setEmployeeId(payload.state.employees[0]?.id ?? "");
        setNotice("Choose an employee and test an effective-dated change or termination.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load UAT workspace."));
  }, []);

  async function persist(nextState: WorkspaceState, message: string) {
    setNotice("Saving…");
    const response = await fetch("/api/pilot/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: nextState }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Unable to save lifecycle change.");
    }
    const payload = await response.json();
    setState(payload.state);
    setNotice(message);
  }

  async function applyRateChange(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected) return;
    const rate = Number(newRate);
    if (!Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      setNotice("Enter a positive rate or salary and a valid effective date.");
      return;
    }
    const nextState = {
      ...state,
      ready: false,
      employees: state.employees.map((employee) => employee.id === selected.id ? { ...employee, rate, rateEffectiveDate: effectiveDate } : employee),
    };
    try {
      await persist(nextState, `${selected.name}'s ${selected.payType === "Hourly" ? "hourly rate" : "annual salary"} is effective ${effectiveDate}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save change.");
    }
  }

  async function terminateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected) return;
    const amounts = [vacationPay, overtimePay, otherTaxablePay, reimbursement].map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(terminationDate) || amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
      setNotice("Enter a valid termination date and non-negative final-pay amounts.");
      return;
    }
    if (selected.hireDate && terminationDate < selected.hireDate) {
      setNotice("Termination date cannot be before the employee's hire date.");
      return;
    }
    const [vacation, overtime, taxable, reimb] = amounts;
    const nextState = {
      ...state,
      ready: false,
      employees: state.employees.map((employee) => employee.id === selected.id ? {
        ...employee,
        status: "Terminating" as const,
        terminationDate,
        finalPay: { vacationPay: vacation, overtimePay: overtime, otherTaxablePay: taxable, reimbursement: reimb },
      } : employee),
    };
    try {
      await persist(nextState, `${selected.name} is marked terminating ${terminationDate}. Final-pay items are saved for payroll review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save termination.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · employee lifecycle UAT</div></div></div>
          <button onClick={() => router.push("/uat")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to UAT</button>
        </header>

        <div className="mt-6 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">{notice}</div>

        <section className="mt-6 rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Employee lifecycle</div>
          <h1 className="mt-2 text-3xl font-semibold">Hire → Change → Terminate</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#795f4f]">Payroll changes need a date. This UAT screen keeps rate changes and terminations tied to an effective date and keeps final-pay items separate for review.</p>
          <label className="mt-5 block max-w-xl text-sm font-medium">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5">{state?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.status}</option>)}</select></label>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <form onSubmit={applyRateChange} className="rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Effective-dated change</div>
            <h2 className="mt-2 text-2xl font-semibold">Change pay</h2>
            <label className="mt-5 block text-sm font-medium">Effective date<input type="date" required value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
            <label className="mt-4 block text-sm font-medium">{selected?.payType === "Salary" ? "New annual salary" : "New hourly rate"}<input type="number" step="0.01" min="0.01" required value={newRate} onChange={(event) => setNewRate(event.target.value)} placeholder={selected ? String(selected.rate) : ""} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
            <button className="mt-5 w-full rounded-xl bg-[#5a321f] px-4 py-3 font-semibold text-white">Save effective-dated change</button>
          </form>

          <form onSubmit={terminateEmployee} className="rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Termination & final pay</div>
            <h2 className="mt-2 text-2xl font-semibold">End employment</h2>
            <label className="mt-5 block text-sm font-medium">Last day employed<input type="date" required value={terminationDate} onChange={(event) => setTerminationDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Vacation pay<input type="number" step="0.01" min="0" value={vacationPay} onChange={(event) => setVacationPay(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
              <label className="text-sm font-medium">Overtime pay<input type="number" step="0.01" min="0" value={overtimePay} onChange={(event) => setOvertimePay(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
              <label className="text-sm font-medium">Other taxable pay<input type="number" step="0.01" min="0" value={otherTaxablePay} onChange={(event) => setOtherTaxablePay(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
              <label className="text-sm font-medium">Reimbursement<input type="number" step="0.01" min="0" value={reimbursement} onChange={(event) => setReimbursement(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
            </div>
            <button className="mt-5 w-full rounded-xl bg-[#5a321f] px-4 py-3 font-semibold text-white">Save termination for review</button>
          </form>
        </section>

        {selected && <section className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Current UAT record</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><div className="text-xs uppercase text-[#8b7464]">Status</div><div className="mt-1 font-semibold">{selected.status}</div></div><div><div className="text-xs uppercase text-[#8b7464]">Rate</div><div className="mt-1 font-semibold">{selected.payType === "Hourly" ? `$${selected.rate.toFixed(2)}/hr` : `$${selected.rate.toLocaleString("en-CA")}/yr`}</div></div><div><div className="text-xs uppercase text-[#8b7464]">Rate effective</div><div className="mt-1 font-semibold">{selected.rateEffectiveDate ?? "Current record"}</div></div><div><div className="text-xs uppercase text-[#8b7464]">Termination</div><div className="mt-1 font-semibold">{selected.terminationDate ?? "Not terminating"}</div></div></div></section>}
      </div>
    </main>
  );
}
