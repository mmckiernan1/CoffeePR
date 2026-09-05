"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ChangeKind = "hire" | "leave" | "pay" | "bonus" | "absence" | "other" | null;
type Employee = {
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
  finalPay?: { vacationPay: number; overtimePay: number; otherTaxablePay: number; reimbursement: number };
};
type Timesheet = { regular: number; overtime: number; vacation: number };
type WorkspaceState = { employees: Employee[]; timesheets: Record<string, Timesheet>; ready: boolean };

const choices: Array<{ id: Exclude<ChangeKind, null>; title: string; detail: string; icon: string }> = [
  { id: "hire", title: "Hired someone", detail: "Add a new employee and their starting pay.", icon: "＋" },
  { id: "leave", title: "Someone left", detail: "Record their last day and final-pay items.", icon: "↗" },
  { id: "pay", title: "Pay changed", detail: "Update an hourly rate or annual salary.", icon: "$" },
  { id: "bonus", title: "Bonus or extra pay", detail: "Add taxable extra pay for this payroll.", icon: "★" },
  { id: "absence", title: "Leave or absence", detail: "Go to hours and pay to record time away.", icon: "◷" },
  { id: "other", title: "Something else", detail: "Leave a note so it is visible during review.", icon: "…" },
];

export default function LifecycleUatPage() {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [kind, setKind] = useState<ChangeKind>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("2026-09-01");
  const [newRate, setNewRate] = useState("");
  const [hireName, setHireName] = useState("");
  const [hireType, setHireType] = useState<"Salary" | "Hourly">("Hourly");
  const [hireRate, setHireRate] = useState("");
  const [hireDate, setHireDate] = useState("2026-09-01");
  const [terminationDate, setTerminationDate] = useState("2026-08-31");
  const [vacationPay, setVacationPay] = useState("0");
  const [overtimePay, setOvertimePay] = useState("0");
  const [otherTaxablePay, setOtherTaxablePay] = useState("0");
  const [reimbursement, setReimbursement] = useState("0");
  const [bonusAmount, setBonusAmount] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [notice, setNotice] = useState("Loading employee changes…");

  const selected = useMemo(() => state?.employees.find((employee) => employee.id === employeeId) ?? null, [employeeId, state]);

  useEffect(() => {
    fetch("/api/pilot/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sign in to use the persistent UAT workspace.");
        const payload = await response.json();
        setState(payload.state);
        setEmployeeId(payload.state.employees[0]?.id ?? "");
        setNotice("Tell Coffee Payroll what changed. We’ll only ask for the details that matter.");
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
      throw new Error(payload.error ?? "Unable to save employee change.");
    }
    const payload = await response.json();
    setState(payload.state);
    setNotice(message);
    setKind(null);
  }

  function nextEmployeeId() {
    const highest = Math.max(0, ...(state?.employees ?? []).map((employee) => Number(employee.id.replace(/\D/g, "")) || 0));
    return `EMP-${String(highest + 1).padStart(4, "0")}`;
  }

  async function addHire(event: FormEvent) {
    event.preventDefault();
    if (!state) return;
    const rate = Number(hireRate);
    if (!hireName.trim() || !Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
      setNotice("Enter the employee’s name, starting pay and hire date.");
      return;
    }
    const id = nextEmployeeId();
    const employee: Employee = { id, name: hireName.trim(), payType: hireType, rate, status: "New hire", hireDate };
    const nextState: WorkspaceState = {
      ...state,
      ready: false,
      employees: [...state.employees, employee],
      timesheets: hireType === "Hourly" ? { ...state.timesheets, [id]: { regular: 0, overtime: 0, vacation: 0 } } : state.timesheets,
    };
    try {
      await persist(nextState, `${employee.name} has been added as a new ${hireType.toLowerCase()} employee.`);
      setHireName(""); setHireRate("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to add employee."); }
  }

  async function applyRateChange(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected) return;
    const rate = Number(newRate);
    if (!Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      setNotice("Enter a positive rate or salary and a valid effective date.");
      return;
    }
    const nextState = { ...state, ready: false, employees: state.employees.map((employee) => employee.id === selected.id ? { ...employee, rate, rateEffectiveDate: effectiveDate } : employee) };
    try { await persist(nextState, `${selected.name}'s ${selected.payType === "Hourly" ? "hourly rate" : "annual salary"} is effective ${effectiveDate}.`); setNewRate(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save pay change."); }
  }

  async function terminateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected) return;
    const amounts = [vacationPay, overtimePay, otherTaxablePay, reimbursement].map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(terminationDate) || amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
      setNotice("Enter a valid last day and non-negative final-pay amounts."); return;
    }
    if (selected.hireDate && terminationDate < selected.hireDate) { setNotice("The last day cannot be before the employee’s hire date."); return; }
    const [vacation, overtime, taxable, reimb] = amounts;
    const nextState = {
      ...state,
      ready: false,
      employees: state.employees.map((employee) => employee.id === selected.id ? { ...employee, status: "Terminating" as const, terminationDate, finalPay: { vacationPay: vacation, overtimePay: overtime, otherTaxablePay: taxable, reimbursement: reimb } } : employee),
    };
    try { await persist(nextState, `${selected.name} is marked as leaving on ${terminationDate}. Final-pay items are ready for review.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save termination."); }
  }

  async function addBonus(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected) return;
    const amount = Number(bonusAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice("Enter the taxable extra-pay amount."); return; }
    const nextState = { ...state, ready: false, employees: state.employees.map((employee) => employee.id === selected.id ? { ...employee, extraTaxablePay: amount } : employee) };
    try { await persist(nextState, `${amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} of extra taxable pay has been added for ${selected.name}.`); setBonusAmount(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save extra pay."); }
  }

  async function saveOther(event: FormEvent) {
    event.preventDefault();
    if (!state || !selected || !otherNote.trim()) { setNotice("Add a short note describing what changed."); return; }
    const nextState = { ...state, ready: false, employees: state.employees.map((employee) => employee.id === selected.id ? { ...employee, changeNote: otherNote.trim().slice(0, 500) } : employee) };
    try { await persist(nextState, `Your note for ${selected.name} has been saved for payroll review.`); setOtherNote(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save note."); }
  }

  const employeePicker = (
    <label className="block text-sm font-medium">Who does this apply to?
      <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5">
        {state?.employees.filter((employee) => employee.status !== "Terminated").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select>
    </label>
  );

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · changes</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <div className="mt-6 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">{notice}</div>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 1 · Changes</div>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">What changed since last payroll?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#795f4f]">Pick the thing that happened. Coffee Payroll will ask only the questions needed for that change.</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {choices.map((choice) => (
              <button key={choice.id} onClick={() => choice.id === "absence" ? router.push("/uat") : setKind(choice.id)} className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${kind === choice.id ? "border-[#8e6046] bg-[#fff6ec] ring-2 ring-[#d9bda8]" : "border-[#e2d4c8] bg-white"}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e6da] text-lg font-bold text-[#6c432e]">{choice.icon}</div>
                <div className="mt-4 font-semibold">{choice.title}</div>
                <div className="mt-1 text-xs leading-5 text-[#826b5a]">{choice.detail}</div>
              </button>
            ))}
          </div>

          {!kind && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8efe6] px-5 py-4"><span className="text-sm text-[#765c4b]">Nothing changed?</span><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-2.5 text-sm font-semibold text-white">Continue to employees</button></div>}
        </section>

        {kind === "hire" && <form onSubmit={addHire} className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm sm:p-7"><h2 className="text-2xl font-semibold">Tell us about the new employee</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Employee name<input value={hireName} onChange={(e) => setHireName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Hire date<input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Paid by<select value={hireType} onChange={(e) => setHireType(e.target.value as "Salary" | "Hourly")} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5"><option>Hourly</option><option>Salary</option></select></label><label className="text-sm font-medium">{hireType === "Hourly" ? "Hourly rate" : "Annual salary"}<input type="number" min="0.01" step="0.01" value={hireRate} onChange={(e) => setHireRate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label></div><button className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Add employee</button></form>}

        {kind === "pay" && <form onSubmit={applyRateChange} className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm sm:p-7"><h2 className="text-2xl font-semibold">What changed with their pay?</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{employeePicker}<label className="text-sm font-medium">Effective date<input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium sm:col-span-2">{selected?.payType === "Salary" ? "New annual salary" : "New hourly rate"}<input type="number" min="0.01" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder={selected ? String(selected.rate) : ""} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label></div><button className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save pay change</button></form>}

        {kind === "leave" && <form onSubmit={terminateEmployee} className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm sm:p-7"><h2 className="text-2xl font-semibold">Someone is leaving</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{employeePicker}<label className="text-sm font-medium">Last day employed<input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Vacation pay<input type="number" min="0" step="0.01" value={vacationPay} onChange={(e) => setVacationPay(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Overtime pay<input type="number" min="0" step="0.01" value={overtimePay} onChange={(e) => setOvertimePay(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Other taxable pay<input type="number" min="0" step="0.01" value={otherTaxablePay} onChange={(e) => setOtherTaxablePay(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label><label className="text-sm font-medium">Reimbursement<input type="number" min="0" step="0.01" value={reimbursement} onChange={(e) => setReimbursement(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label></div><button className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save leaving employee</button></form>}

        {kind === "bonus" && <form onSubmit={addBonus} className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm sm:p-7"><h2 className="text-2xl font-semibold">Add bonus or extra pay</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{employeePicker}<label className="text-sm font-medium">Taxable extra pay<input type="number" min="0.01" step="0.01" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label></div><p className="mt-4 text-xs leading-5 text-[#806858]">This pilot treats the amount as taxable cash earnings in the current payroll calculation.</p><button className="mt-5 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Add extra pay</button></form>}

        {kind === "other" && <form onSubmit={saveOther} className="mt-5 rounded-[26px] border border-[#decdbd] bg-white p-6 shadow-sm sm:p-7"><h2 className="text-2xl font-semibold">What else changed?</h2><div className="mt-5">{employeePicker}<label className="mt-4 block text-sm font-medium">Short note<textarea value={otherNote} onChange={(e) => setOtherNote(e.target.value)} maxLength={500} rows={4} placeholder="Example: employee requested a payroll adjustment for review" className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-3 py-2.5" /></label></div><button className="mt-5 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save note for review</button></form>}
      </div>
    </main>
  );
}
