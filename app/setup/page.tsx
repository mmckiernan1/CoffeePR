"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { employeeCsvTemplate, parseEmployeeCsv } from "@/lib/payroll/employee-import";
import type { PilotProfile, PilotUatEmployee, PilotUatState } from "@/lib/payroll/pilot-uat";

const steps = [
  ["1", "Business"],
  ["2", "CRA payroll"],
  ["3", "Pay schedule"],
  ["4", "Employees"],
  ["5", "Opening balances"],
  ["6", "Review"],
] as const;

const setupDraftKey = "coffee-payroll:setup-draft";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "", province: "Alberta", frequency: "Biweekly", employeeCount: 1 });
  const [state, setState] = useState<PilotUatState>({ employees: [], timesheets: {}, ready: false });
  const [craSuffix, setCraSuffix] = useState("");
  const [openingBalances, setOpeningBalances] = useState<"yes" | "no" | "">("");
  const [employeeMode, setEmployeeMode] = useState<"manual" | "csv">("manual");
  const [name, setName] = useState("");
  const [payType, setPayType] = useState<"Salary" | "Hourly">("Hourly");
  const [rate, setRate] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("Loading your Coffee Payroll setup…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pilot/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sign in to set up Coffee Payroll.");
        const payload = await response.json();
        if (cancelled) return;
        setProfile(payload.profile);
        const freshWorkspace = payload.profile.businessName === "My business";
        setState(freshWorkspace ? { employees: [], timesheets: {}, ready: false } : payload.state);
        try {
          const draft = JSON.parse(window.localStorage.getItem(setupDraftKey) ?? "{}");
          setCraSuffix(typeof draft.craSuffix === "string" ? draft.craSuffix : "");
          setOpeningBalances(draft.openingBalances === "yes" || draft.openingBalances === "no" ? draft.openingBalances : "");
        } catch {}
        setNotice("We’ll set up the essentials one step at a time.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load setup."));
    return () => { cancelled = true; };
  }, []);

  const hourlyCount = useMemo(() => state.employees.filter((employee) => employee.payType === "Hourly").length, [state.employees]);

  function saveLocalDraft(nextCra = craSuffix, nextOpening = openingBalances) {
    window.localStorage.setItem(setupDraftKey, JSON.stringify({ craSuffix: nextCra, openingBalances: nextOpening }));
  }

  async function saveWorkspace(nextProfile = profile, nextState = state) {
    setBusy(true);
    setNotice("Saving…");
    try {
      const response = await fetch("/api/pilot/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { ...nextProfile, employeeCount: Math.max(1, nextState.employees.length) }, state: nextState }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save setup.");
      setProfile(payload.profile);
      setState(payload.state);
      setNotice("Saved.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save setup.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function continueBusiness(event: FormEvent) {
    event.preventDefault();
    if (!profile.businessName.trim()) return setNotice("Enter your business name.");
    if (await saveWorkspace({ ...profile, businessName: profile.businessName.trim() })) setStep(2);
  }

  function continueCra(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(craSuffix)) return setNotice("Enter the last four digits of your CRA payroll program account.");
    saveLocalDraft();
    setNotice("CRA checkpoint saved for this setup session.");
    setStep(3);
  }

  async function continueSchedule(event: FormEvent) {
    event.preventDefault();
    if (await saveWorkspace(profile)) setStep(4);
  }

  async function addEmployee(event: FormEvent) {
    event.preventDefault();
    const amount = Number(rate);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
      return setNotice("Enter the employee name, hire date and starting pay.");
    }
    const nextNumber = Math.max(0, ...state.employees.map((employee) => Number(employee.id.replace(/\D/g, "")) || 0)) + 1;
    const id = `EMP-${String(nextNumber).padStart(4, "0")}`;
    const employee: PilotUatEmployee = {
      id, name: name.trim(), payType, rate: amount, rateHistory: [{ effectiveDate: hireDate, rate: amount }],
      status: "Active", hireDate, taxSetupComplete: false,
    };
    const nextState: PilotUatState = {
      employees: [...state.employees, employee],
      timesheets: payType === "Hourly" ? { ...state.timesheets, [id]: { regular: 0, overtime: 0, vacation: 0 } } : state.timesheets,
      ready: false,
    };
    if (await saveWorkspace(profile, nextState)) {
      setName(""); setRate(""); setHireDate("");
      setNotice(`${employee.name} was added. Tax setup will be reviewed before the first payroll.`);
    }
  }

  async function importCsvText(text: string) {
    const startingNumber = Math.max(0, ...state.employees.map((employee) => Number(employee.id.replace(/\D/g, "")) || 0)) + 1;
    const result = parseEmployeeCsv(text, startingNumber);
    setCsvErrors(result.errors);
    setCsvPreview(text);
    if (result.errors.length > 0) return;
    const nextEmployees = [...state.employees, ...result.employees];
    const nextTimesheets = { ...state.timesheets };
    result.employees.filter((employee) => employee.payType === "Hourly").forEach((employee) => {
      nextTimesheets[employee.id] = { regular: 0, overtime: 0, vacation: 0 };
    });
    if (await saveWorkspace(profile, { employees: nextEmployees, timesheets: nextTimesheets, ready: false })) {
      setNotice(`${result.employees.length} employee${result.employees.length === 1 ? "" : "s"} imported. Tax setup still needs review before payroll approval.`);
      setCsvPreview("");
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([employeeCsvTemplate()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "coffee-payroll-employee-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function continueOpening(value: "yes" | "no") {
    setOpeningBalances(value);
    saveLocalDraft(craSuffix, value);
    setStep(6);
    setNotice(value === "yes" ? "Opening balances are flagged for review before the first live payroll." : "No prior-year payroll balances were flagged.");
  }

  const canFinish = profile.businessName.trim() && /^\d{4}$/.test(craSuffix) && state.employees.length > 0 && openingBalances;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-6 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · setup</div></div></div>
          <button onClick={() => router.push("/")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Exit setup</button>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-5 shadow-sm sm:p-7">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {steps.map(([number, label]) => <button key={number} onClick={() => setStep(Number(number))} className={`min-w-[132px] rounded-xl border px-3 py-3 text-left ${step === Number(number) ? "border-[#8e6046] bg-[#f3e6da]" : "border-[#e3d6ca] bg-white"}`}><span className="text-[10px] font-bold text-[#92715d]">STEP {number}</span><div className="mt-1 text-sm font-semibold">{label}</div></button>)}
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">{notice}</div>

        {step === 1 && <form onSubmit={continueBusiness} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 1 · Business</div><h1 className="mt-2 text-3xl font-semibold">Tell us about your business</h1><p className="mt-2 text-sm text-[#795f4f]">Just the basics for now. We’ll keep the setup moving.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Business name<input value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></label><label className="text-sm font-medium">Province<select value={profile.province} onChange={(e) => setProfile({ ...profile, province: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3"><option>Alberta</option></select><span className="mt-1 block text-xs text-[#8b7464]">Alberta is the validated pilot calculation pack.</span></label></div><button disabled={busy} className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save and continue</button></form>}

        {step === 2 && <form onSubmit={continueCra} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 2 · CRA payroll</div><h1 className="mt-2 text-3xl font-semibold">Connect the payroll account</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">For this pilot checkpoint, enter only the last four digits of the RP program account. Full CRA account storage will be enabled with the secure hosted setup fields.</p><label className="mt-6 block max-w-sm text-sm font-medium">Last four digits<input inputMode="numeric" maxLength={4} value={craSuffix} onChange={(e) => setCraSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3 font-mono" /></label><button className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save and continue</button></form>}

        {step === 3 && <form onSubmit={continueSchedule} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 3 · Pay schedule</div><h1 className="mt-2 text-3xl font-semibold">How often do you pay your team?</h1><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Weekly", "Biweekly", "Semi-monthly", "Monthly"].map((frequency) => <button type="button" key={frequency} onClick={() => setProfile({ ...profile, frequency })} className={`rounded-2xl border p-5 text-left ${profile.frequency === frequency ? "border-[#8e6046] bg-[#fff6ec] ring-2 ring-[#d9bda8]" : "border-[#e2d4c8] bg-white"}`}><div className="font-semibold">{frequency}</div></button>)}</div><button disabled={busy} className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Save and continue</button></form>}

        {step === 4 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 4 · Employees</div><h1 className="mt-2 text-3xl font-semibold">Bring in your employees</h1><p className="mt-2 text-sm text-[#795f4f]">Add people one at a time or import a CSV. Either way, Coffee Payroll will flag statutory setup for review before approval.</p><div className="mt-5 flex gap-2"><button onClick={() => setEmployeeMode("manual")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${employeeMode === "manual" ? "bg-[#5a321f] text-white" : "border border-[#d8c8ba]"}`}>Add manually</button><button onClick={() => setEmployeeMode("csv")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${employeeMode === "csv" ? "bg-[#5a321f] text-white" : "border border-[#d8c8ba]"}`}>Import CSV</button></div>{employeeMode === "manual" ? <form onSubmit={addEmployee} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Employee name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></label><label className="text-sm font-medium">Hire date<input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></label><label className="text-sm font-medium">Paid by<select value={payType} onChange={(e) => setPayType(e.target.value as "Salary" | "Hourly")} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3"><option>Hourly</option><option>Salary</option></select></label><label className="text-sm font-medium">{payType === "Hourly" ? "Hourly rate" : "Annual salary"}<input type="number" min="0.01" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></label><button disabled={busy} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white sm:col-span-2 sm:w-fit">Add employee</button></form> : <div className="mt-6 rounded-2xl border border-dashed border-[#cdb9a8] bg-[#fffaf5] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">Employee CSV</div><p className="mt-1 text-xs text-[#826b5a]">Required columns: employee_name, pay_type, rate, hire_date</p></div><button onClick={downloadTemplate} className="rounded-xl border border-[#d8c8ba] bg-white px-4 py-2 text-sm font-semibold">Download template</button></div><input type="file" accept=".csv,text/csv" className="mt-5 block w-full text-sm" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await importCsvText(await file.text()); }} />{csvPreview && <p className="mt-3 text-xs text-[#826b5a]">File loaded for validation.</p>}{csvErrors.length > 0 && <div className="mt-4 rounded-xl border border-[#e2b999] bg-[#fff6ec] p-4 text-sm text-[#714a32]">{csvErrors.map((error) => <div key={error}>{error}</div>)}</div>}</div>}<div className="mt-7 rounded-2xl bg-[#f8efe6] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{state.employees.length} employee{state.employees.length === 1 ? "" : "s"} added</strong><div className="mt-1 text-xs text-[#826b5a]">{hourlyCount} hourly · {state.employees.length - hourlyCount} salary</div></div><button disabled={state.employees.length === 0} onClick={() => setStep(5)} className="rounded-xl bg-[#5a321f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue</button></div></div></section>}

        {step === 5 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 5 · Opening balances</div><h1 className="mt-2 text-3xl font-semibold">Have you already paid anyone this year?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">If you’re moving to Coffee Payroll during the year, we’ll need year-to-date earnings and deductions before the first live payroll.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => continueOpening("yes")} className="rounded-2xl border border-[#e2d4c8] p-5 text-left hover:bg-[#fff6ec]"><div className="font-semibold">Yes, we have prior payroll</div><p className="mt-1 text-xs text-[#826b5a]">Flag opening balances for review.</p></button><button onClick={() => continueOpening("no")} className="rounded-2xl border border-[#e2d4c8] p-5 text-left hover:bg-[#fff6ec]"><div className="font-semibold">No, this is our first payroll</div><p className="mt-1 text-xs text-[#826b5a]">Continue without opening balances.</p></button></div></section>}

        {step === 6 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 6 · Review</div><h1 className="mt-2 text-3xl font-semibold">Your payroll workspace is taking shape</h1><div className="mt-6 grid gap-3 sm:grid-cols-2"><Review label="Business" value={profile.businessName || "Needed"} /><Review label="Province" value={profile.province} /><Review label="Pay frequency" value={profile.frequency} /><Review label="Employees" value={`${state.employees.length}`} /><Review label="CRA payroll account" value={/^\d{4}$/.test(craSuffix) ? `RP •••• ${craSuffix}` : "Needed"} /><Review label="Opening balances" value={openingBalances === "yes" ? "Review needed" : openingBalances === "no" ? "None flagged" : "Needed"} /></div><div className="mt-6 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] p-5 text-sm leading-6 text-[#714a32]"><strong>One important checkpoint remains:</strong> each employee’s statutory/tax setup must be reviewed before Coffee Payroll will allow payroll approval.</div><button disabled={!canFinish} onClick={() => router.push("/uat/tax-setup")} className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white disabled:opacity-40">Review employee tax setup</button></section>}
      </div>
    </main>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f8efe6] p-4"><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#92715d]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
