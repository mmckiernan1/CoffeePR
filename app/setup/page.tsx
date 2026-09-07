"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { employeeCsvTemplate, parseEmployeeCsv } from "@/lib/payroll/employee-import";
import { openingBalanceCsvTemplate, parseOpeningBalanceCsv, type OpeningBalanceImportRow } from "@/lib/payroll/opening-balance-import";
import { pilotOpeningBalanceMap } from "@/lib/payroll/pilot-opening-balances";
import type { PilotProfile, PilotUatEmployee, PilotUatState } from "@/lib/payroll/pilot-uat";

const steps = [
  ["1", "Business"], ["2", "CRA payroll"], ["3", "Pay schedule"], ["4", "Employees"], ["5", "Opening balances"], ["6", "Review"],
] as const;
const setupDraftKey = "coffee-payroll:setup-draft";

type SetupDraft = { craSuffix?: string; openingBalances?: "yes" | "no"; openingBalanceRows?: OpeningBalanceImportRow[] };

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "", province: "Alberta", frequency: "Biweekly", employeeCount: 1 });
  const [state, setState] = useState<PilotUatState>({ employees: [], timesheets: {}, openingBalances: {}, ready: false });
  const [craSuffix, setCraSuffix] = useState("");
  const [openingBalances, setOpeningBalances] = useState<"yes" | "no" | "">("");
  const [openingBalanceRows, setOpeningBalanceRows] = useState<OpeningBalanceImportRow[]>([]);
  const [openingErrors, setOpeningErrors] = useState<string[]>([]);
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
        setState(freshWorkspace ? { employees: [], timesheets: {}, openingBalances: {}, ready: false } : payload.state);
        try {
          const draft = JSON.parse(window.localStorage.getItem(setupDraftKey) ?? "{}") as SetupDraft;
          setCraSuffix(typeof draft.craSuffix === "string" ? draft.craSuffix : "");
          setOpeningBalances(draft.openingBalances === "yes" || draft.openingBalances === "no" ? draft.openingBalances : "");
          setOpeningBalanceRows(Array.isArray(draft.openingBalanceRows) ? draft.openingBalanceRows : []);
        } catch {}
        setNotice("We’ll set up the essentials one step at a time.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load setup."));
    return () => { cancelled = true; };
  }, []);

  const hourlyCount = useMemo(() => state.employees.filter((employee) => employee.payType === "Hourly").length, [state.employees]);
  const openingCoverage = useMemo(() => new Set(openingBalanceRows.map((row) => row.employeeId)).size, [openingBalanceRows]);

  function saveLocalDraft(nextCra = craSuffix, nextOpening = openingBalances, nextRows = openingBalanceRows) {
    const draft: SetupDraft = { craSuffix: nextCra, openingBalances: nextOpening || undefined, openingBalanceRows: nextRows };
    window.localStorage.setItem(setupDraftKey, JSON.stringify(draft));
  }

  async function saveWorkspace(nextProfile = profile, nextState = state) {
    setBusy(true); setNotice("Saving…");
    try {
      const response = await fetch("/api/pilot/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { ...nextProfile, employeeCount: Math.max(1, nextState.employees.length) }, state: nextState }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save setup.");
      setProfile(payload.profile); setState(payload.state); setNotice("Saved."); return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save setup."); return false; }
    finally { setBusy(false); }
  }

  async function continueBusiness(event: FormEvent) { event.preventDefault(); if (!profile.businessName.trim()) return setNotice("Enter your business name."); if (await saveWorkspace({ ...profile, businessName: profile.businessName.trim() })) setStep(2); }
  function continueCra(event: FormEvent) { event.preventDefault(); if (!/^\d{4}$/.test(craSuffix)) return setNotice("Enter the last four digits of your CRA payroll program account."); saveLocalDraft(); setNotice("CRA checkpoint saved for this setup session."); setStep(3); }
  async function continueSchedule(event: FormEvent) { event.preventDefault(); if (await saveWorkspace(profile)) setStep(4); }

  async function addEmployee(event: FormEvent) {
    event.preventDefault(); const amount = Number(rate);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) return setNotice("Enter the employee name, hire date and starting pay.");
    const nextNumber = Math.max(0, ...state.employees.map((employee) => Number(employee.id.replace(/\D/g, "")) || 0)) + 1;
    const id = `EMP-${String(nextNumber).padStart(4, "0")}`;
    const employee: PilotUatEmployee = { id, name: name.trim(), payType, rate: amount, rateHistory: [{ effectiveDate: hireDate, rate: amount }], status: "Active", hireDate, taxSetupComplete: false };
    const nextState: PilotUatState = { employees: [...state.employees, employee], timesheets: payType === "Hourly" ? { ...state.timesheets, [id]: { regular: 0, overtime: 0, vacation: 0 } } : state.timesheets, openingBalances: {}, ready: false };
    if (await saveWorkspace(profile, nextState)) { setName(""); setRate(""); setHireDate(""); setOpeningBalances(""); setOpeningBalanceRows([]); saveLocalDraft(craSuffix, "", []); setNotice(`${employee.name} was added. Statutory setup will be reviewed before the first payroll.`); }
  }

  async function importCsvText(text: string) {
    const startingNumber = Math.max(0, ...state.employees.map((employee) => Number(employee.id.replace(/\D/g, "")) || 0)) + 1;
    const result = parseEmployeeCsv(text, startingNumber); setCsvErrors(result.errors); setCsvPreview(text); if (result.errors.length > 0) return;
    const nextEmployees = [...state.employees, ...result.employees]; const nextTimesheets = { ...state.timesheets };
    result.employees.filter((employee) => employee.payType === "Hourly").forEach((employee) => { nextTimesheets[employee.id] = { regular: 0, overtime: 0, vacation: 0 }; });
    if (await saveWorkspace(profile, { employees: nextEmployees, timesheets: nextTimesheets, openingBalances: {}, ready: false })) { setOpeningBalances(""); setOpeningBalanceRows([]); saveLocalDraft(craSuffix, "", []); setNotice(`${result.employees.length} employee${result.employees.length === 1 ? "" : "s"} imported. Statutory setup still needs review before payroll approval.`); setCsvPreview(""); }
  }

  function downloadText(filename: string, text: string) { const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
  function downloadEmployeeTemplate() { downloadText("coffee-payroll-employee-import-template.csv", employeeCsvTemplate()); }
  function downloadOpeningTemplate() { downloadText("coffee-payroll-opening-balances-template.csv", openingBalanceCsvTemplate(state.employees)); }

  async function importOpeningBalances(text: string) {
    const result = parseOpeningBalanceCsv(text, state.employees); setOpeningErrors(result.errors);
    if (result.errors.length > 0) { setNotice("Fix the opening-balance CSV items shown below before continuing."); return; }
    const covered = new Set(result.rows.map((row) => row.employeeId));
    const missing = state.employees.filter((employee) => !covered.has(employee.id));
    if (missing.length > 0) { setOpeningErrors([`Add a row for every employee, including zero balances. Missing: ${missing.map((employee) => employee.name).join(", ")}.`]); return; }
    const nextState = { ...state, openingBalances: pilotOpeningBalanceMap(result.rows), ready: false };
    if (!(await saveWorkspace(profile, nextState))) return;
    setOpeningBalances("yes"); setOpeningBalanceRows(result.rows); saveLocalDraft(craSuffix, "yes", result.rows);
    setNotice(`${result.rows.length} opening-balance row${result.rows.length === 1 ? "" : "s"} validated and saved to the pilot workspace.`);
  }

  async function chooseNoOpeningBalances() {
    const nextState = { ...state, openingBalances: {}, ready: false };
    if (!(await saveWorkspace(profile, nextState))) return;
    setOpeningBalances("no"); setOpeningBalanceRows([]); setOpeningErrors([]); saveLocalDraft(craSuffix, "no", []); setNotice("No opening balances are needed for this business."); setStep(6);
  }
  function choosePriorPayroll() { setOpeningBalances("yes"); saveLocalDraft(craSuffix, "yes", openingBalanceRows); setNotice("Download the employee-specific template, enter year-to-date amounts, then upload it here."); }
  function continueOpeningBalances() { if (openingBalances !== "yes" || openingBalanceRows.length !== state.employees.length) return setNotice("Validate one opening-balance row for every employee before continuing."); setStep(6); }
  async function clearOpeningChoice() { await saveWorkspace(profile, { ...state, openingBalances: {}, ready: false }); setOpeningBalances(""); setOpeningBalanceRows([]); setOpeningErrors([]); saveLocalDraft(craSuffix, "", []); }

  const canFinish = Boolean(profile.businessName.trim() && /^\d{4}$/.test(craSuffix) && state.employees.length > 0 && (openingBalances === "no" || (openingBalances === "yes" && openingBalanceRows.length === state.employees.length)));

  return <main className="min-h-screen bg-[#f4eadf] px-4 py-6 text-[#332118] sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · setup</div></div></div><button onClick={() => router.push("/")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Exit setup</button></header>
    <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-5 shadow-sm sm:p-7"><div className="flex gap-2 overflow-x-auto pb-2">{steps.map(([number, label]) => <button key={number} onClick={() => setStep(Number(number))} className={`min-w-[132px] rounded-xl border px-3 py-3 text-left ${step === Number(number) ? "border-[#8e6046] bg-[#f3e6da]" : "border-[#e3d6ca] bg-white"}`}><span className="text-[10px] font-bold text-[#92715d]">STEP {number}</span><div className="mt-1 text-sm font-semibold">{label}</div></button>)}</div></section>
    <div className="mt-4 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">{notice}</div>

    {step === 1 && <form onSubmit={continueBusiness} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 1 · Business"/><h1 className="mt-2 text-3xl font-semibold">Tell us about your business</h1><p className="mt-2 text-sm text-[#795f4f]">Just the basics for now. We’ll keep the setup moving.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Business name"><input value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></Field><Field label="Province"><select value={profile.province} onChange={(e) => setProfile({ ...profile, province: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3"><option>Alberta</option></select><span className="mt-1 block text-xs text-[#8b7464]">Alberta is the validated pilot calculation pack.</span></Field></div><Primary disabled={busy}>Save and continue</Primary></form>}

    {step === 2 && <form onSubmit={continueCra} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 2 · CRA payroll"/><h1 className="mt-2 text-3xl font-semibold">Connect the payroll account</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">For this pilot checkpoint, enter only the last four digits of the RP program account. Full CRA account storage will be enabled with the secure hosted setup fields.</p><label className="mt-6 block max-w-sm text-sm font-medium">Last four digits<input inputMode="numeric" maxLength={4} value={craSuffix} onChange={(e) => setCraSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3 font-mono" /></label><Primary>Save and continue</Primary></form>}

    {step === 3 && <form onSubmit={continueSchedule} className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 3 · Pay schedule"/><h1 className="mt-2 text-3xl font-semibold">How often do you pay your team?</h1><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Weekly", "Biweekly", "Semi-monthly", "Monthly"].map((frequency) => <button type="button" key={frequency} onClick={() => setProfile({ ...profile, frequency })} className={`rounded-2xl border p-5 text-left ${profile.frequency === frequency ? "border-[#8e6046] bg-[#fff6ec] ring-2 ring-[#d9bda8]" : "border-[#e2d4c8] bg-white"}`}><div className="font-semibold">{frequency}</div></button>)}</div><Primary disabled={busy}>Save and continue</Primary></form>}

    {step === 4 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 4 · Employees"/><h1 className="mt-2 text-3xl font-semibold">Bring in your employees</h1><p className="mt-2 text-sm text-[#795f4f]">Add people one at a time or import a CSV. Either way, Coffee Payroll will flag statutory setup for review before approval.</p><div className="mt-5 flex gap-2"><Mode active={employeeMode === "manual"} onClick={() => setEmployeeMode("manual")}>Add manually</Mode><Mode active={employeeMode === "csv"} onClick={() => setEmployeeMode("csv")}>Import CSV</Mode></div>{employeeMode === "manual" ? <form onSubmit={addEmployee} className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Employee name"><input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></Field><Field label="Hire date"><input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></Field><Field label="Paid by"><select value={payType} onChange={(e) => setPayType(e.target.value as "Salary" | "Hourly")} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3"><option>Hourly</option><option>Salary</option></select></Field><Field label={payType === "Hourly" ? "Hourly rate" : "Annual salary"}><input type="number" min="0.01" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] px-4 py-3" /></Field><button disabled={busy} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white sm:col-span-2 sm:w-fit">Add employee</button></form> : <UploadBox title="Employee CSV" detail="Required columns: employee_name, pay_type, rate, hire_date" onTemplate={downloadEmployeeTemplate} onFile={async (file) => importCsvText(await file.text())} errors={csvErrors} loaded={Boolean(csvPreview)} />}
      <div className="mt-7 rounded-2xl bg-[#f8efe6] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{state.employees.length} employee{state.employees.length === 1 ? "" : "s"} added</strong><div className="mt-1 text-xs text-[#826b5a]">{hourlyCount} hourly · {state.employees.length - hourlyCount} salary</div></div><button disabled={state.employees.length === 0} onClick={() => setStep(5)} className="rounded-xl bg-[#5a321f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue</button></div></div></section>}

    {step === 5 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 5 · Opening balances"/><h1 className="mt-2 text-3xl font-semibold">Have you already paid anyone this year?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">If you’re moving to Coffee Payroll during the year, we need year-to-date earnings and statutory deductions so the next payroll starts from the right place.</p>
      {openingBalances !== "yes" && <div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={choosePriorPayroll} className="rounded-2xl border border-[#e2d4c8] p-5 text-left hover:bg-[#fff6ec]"><div className="font-semibold">Yes, we have prior payroll</div><p className="mt-1 text-xs text-[#826b5a]">Import year-to-date balances for each employee.</p></button><button onClick={() => void chooseNoOpeningBalances()} className="rounded-2xl border border-[#e2d4c8] p-5 text-left hover:bg-[#fff6ec]"><div className="font-semibold">No, this is our first payroll</div><p className="mt-1 text-xs text-[#826b5a]">Continue without opening balances.</p></button></div>}
      {openingBalances === "yes" && <div className="mt-6"><div className="rounded-2xl border border-[#d9e2ce] bg-[#f7fbf4] p-4 text-sm leading-6 text-[#53684a]"><strong>Use your last payroll register or YTD report.</strong> Enter taxable, pensionable and insurable earnings plus income tax, CPP, CPP2 and EI withheld through the balance date. Include every employee, using zero where an amount does not apply.</div><div className="mt-4"><UploadBox title="Opening-balance CSV" detail="The template is pre-filled with your current employee IDs and names." onTemplate={downloadOpeningTemplate} onFile={async (file) => importOpeningBalances(await file.text())} errors={openingErrors} loaded={openingBalanceRows.length > 0} /></div>{openingBalanceRows.length > 0 && <div className="mt-4 rounded-2xl bg-[#f8efe6] p-5"><strong>{openingCoverage} of {state.employees.length} employees saved</strong><p className="mt-1 text-xs leading-5 text-[#826b5a]">These validated balances are now stored in the pilot workspace and feed the pilot’s year-to-date CPP and EI calculation state. A production statutory ledger posting remains a separate deployment step.</p></div>}<div className="mt-5 flex flex-wrap gap-3"><button onClick={() => void clearOpeningChoice()} className="rounded-xl border border-[#d8c8ba] px-4 py-3 text-sm font-semibold">Back</button><button disabled={openingBalanceRows.length !== state.employees.length} onClick={continueOpeningBalances} className="rounded-xl bg-[#5a321f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue</button></div></div>}
    </section>}

    {step === 6 && <section className="mt-5 rounded-[28px] border border-[#decdbd] bg-white p-6 sm:p-8"><Eyebrow text="Step 6 · Review"/><h1 className="mt-2 text-3xl font-semibold">Your payroll workspace is taking shape</h1><div className="mt-6 grid gap-3 sm:grid-cols-2"><Review label="Business" value={profile.businessName || "Needed"}/><Review label="Province" value={profile.province}/><Review label="Pay frequency" value={profile.frequency}/><Review label="Employees" value={`${state.employees.length}`}/><Review label="CRA payroll account" value={/^\d{4}$/.test(craSuffix) ? `RP •••• ${craSuffix}` : "Needed"}/><Review label="Opening balances" value={openingBalances === "yes" ? `${openingBalanceRows.length} employee row${openingBalanceRows.length === 1 ? "" : "s"} saved` : openingBalances === "no" ? "None needed" : "Needed"}/></div><div className="mt-6 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] p-5 text-sm leading-6 text-[#714a32]"><strong>One important checkpoint remains:</strong> each employee’s statutory/tax setup must be reviewed before Coffee Payroll will allow payroll approval.</div><button disabled={!canFinish} onClick={() => router.push("/uat/tax-setup")} className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white disabled:opacity-40">Review employee tax setup</button></section>}
  </div></main>;
}

function Eyebrow({ text }: { text: string }) { return <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">{text}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-sm font-medium">{label}{children}</label>; }
function Primary({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) { return <button disabled={disabled} className="mt-6 rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white disabled:opacity-40">{children}</button>; }
function Mode({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-semibold ${active ? "bg-[#5a321f] text-white" : "border border-[#d8c8ba]"}`}>{children}</button>; }
function UploadBox({ title, detail, onTemplate, onFile, errors, loaded }: { title: string; detail: string; onTemplate: () => void; onFile: (file: File) => Promise<void>; errors: string[]; loaded: boolean }) { return <div className="rounded-2xl border border-dashed border-[#cdb9a8] bg-[#fffaf5] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{title}</div><p className="mt-1 text-xs text-[#826b5a]">{detail}</p></div><button type="button" onClick={onTemplate} className="rounded-xl border border-[#d8c8ba] bg-white px-4 py-2 text-sm font-semibold">Download template</button></div><input type="file" accept=".csv,text/csv" className="mt-5 block w-full text-sm" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await onFile(file); }} />{loaded && <p className="mt-3 text-xs font-semibold text-[#4f6944]">✓ File validated and saved.</p>}{errors.length > 0 && <div className="mt-4 rounded-xl border border-[#e2b999] bg-[#fff6ec] p-4 text-sm text-[#714a32]">{errors.map((error) => <div key={error}>{error}</div>)}</div>}</div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#f8efe6] p-4"><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#92715d]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
