"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire";
};

type Timesheet = { regular: number; overtime: number; vacation: number };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type SaveMode = "loading" | "cloud" | "saving" | "local" | "error";

const starterEmployees: UatEmployee[] = [
  { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, status: "Active" },
  { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, status: "Active" },
  { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, status: "Active" },
  { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, status: "Active" },
];

const starterTime: Record<string, Timesheet> = {
  "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 },
  "EMP-0004": { regular: 72, overtime: 0, vacation: 0 },
};

const localStorageKey = "coffee-payroll:pilot-uat";

function defaultState(): UatState {
  return { employees: starterEmployees, timesheets: starterTime, ready: false };
}

function saveLabel(mode: SaveMode) {
  if (mode === "loading") return "Loading workspace…";
  if (mode === "saving") return "Saving…";
  if (mode === "cloud") return "Saved to your pilot workspace";
  if (mode === "local") return "Saved on this device · sign in for workspace sync";
  return "Save needs attention";
}

export default function PilotUatPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<UatEmployee[]>(starterEmployees);
  const [timesheets, setTimesheets] = useState<Record<string, Timesheet>>(starterTime);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("Loading your pilot workspace…");
  const [saveMode, setSaveMode] = useState<SaveMode>("loading");
  const [hydrated, setHydrated] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [hireName, setHireName] = useState("");
  const [hireType, setHireType] = useState<"Salary" | "Hourly">("Hourly");
  const [hireRate, setHireRate] = useState("25");
  const [changeEmployee, setChangeEmployee] = useState("EMP-0002");
  const [changeRate, setChangeRate] = useState("31.50");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hourlyEmployees = useMemo(() => employees.filter((employee) => employee.payType === "Hourly"), [employees]);
  const allHourlyHaveTime = hourlyEmployees.every((employee) => {
    const row = timesheets[employee.id];
    return row && row.regular >= 0 && row.overtime >= 0 && row.vacation >= 0;
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (cancelled) return;
          setEmployees(payload.state.employees);
          setTimesheets(payload.state.timesheets);
          setReady(payload.state.ready);
          setWorkspaceName(payload.profile?.businessName ?? null);
          setSaveMode("cloud");
          setNotice("Persistent UAT workspace loaded. Hires, changes and timesheets will follow this signed-in business.");
          setHydrated(true);
          return;
        }

        const local = window.localStorage.getItem(localStorageKey);
        if (local) {
          const parsed = JSON.parse(local) as UatState;
          if (!cancelled && Array.isArray(parsed.employees) && parsed.timesheets) {
            setEmployees(parsed.employees);
            setTimesheets(parsed.timesheets);
            setReady(Boolean(parsed.ready));
          }
        }
        if (!cancelled) {
          setSaveMode("local");
          setNotice("UAT is saved on this device for now. Sign in after Supabase is configured to sync it to your business workspace.");
          setHydrated(true);
        }
      } catch {
        if (!cancelled) {
          setSaveMode("local");
          setNotice("Workspace sync is unavailable, so this UAT session is being kept safely on this device.");
          setHydrated(true);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: UatState = { employees, timesheets, ready };
    window.localStorage.setItem(localStorageKey, JSON.stringify(state));

    if (saveMode === "local" || saveMode === "error") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveMode("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/pilot/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) throw new Error("save failed");
        setSaveMode("cloud");
      } catch {
        setSaveMode("error");
        setNotice("The server save did not complete. Your latest UAT changes are still saved on this device.");
      }
    }, 650);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [employees, timesheets, ready, hydrated]);

  function addHire(event: FormEvent) {
    event.preventDefault();
    const rate = Number(hireRate);
    if (!hireName.trim() || !Number.isFinite(rate) || rate <= 0) return;
    const id = `EMP-UAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const employee: UatEmployee = { id, name: hireName.trim(), payType: hireType, rate, status: "New hire" };
    setEmployees((current) => [...current, employee]);
    if (hireType === "Hourly") setTimesheets((current) => ({ ...current, [id]: { regular: 0, overtime: 0, vacation: 0 } }));
    setReady(false);
    setHireName("");
    setNotice(`${employee.name} was added as a UAT new hire and will remain in this workspace.`);
  }

  function applyRateChange(event: FormEvent) {
    event.preventDefault();
    const rate = Number(changeRate);
    const employee = employees.find((item) => item.id === changeEmployee);
    if (!employee || !Number.isFinite(rate) || rate <= 0) return;
    setEmployees((current) => current.map((item) => item.id === changeEmployee ? { ...item, rate } : item));
    setReady(false);
    setNotice(`${employee.name}'s ${employee.payType === "Hourly" ? "hourly rate" : "annual salary"} change is saved for payroll review.`);
  }

  function updateTime(id: string, field: keyof Timesheet, value: string) {
    const number = Number(value);
    setTimesheets((current) => ({ ...current, [id]: { ...(current[id] ?? { regular: 0, overtime: 0, vacation: 0 }), [field]: Number.isFinite(number) && number >= 0 ? number : 0 } }));
    setReady(false);
  }

  async function resetUat() {
    const state = defaultState();
    setEmployees(state.employees);
    setTimesheets(state.timesheets);
    setReady(false);
    setNotice("UAT sample data was reset.");
    window.localStorage.setItem(localStorageKey, JSON.stringify(state));

    if (saveMode === "cloud" || saveMode === "saving") {
      try {
        await fetch("/api/pilot/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resetState: true }) });
        setSaveMode("cloud");
      } catch {
        setSaveMode("error");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · pilot UAT</div></div></div>
          <div className="flex gap-2"><button onClick={() => router.push("/")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Main menu</button><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-4 py-2 text-sm font-semibold text-white">Run payroll preview</button></div>
        </header>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">
          <span>{notice}</span>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold">{workspaceName ? `${workspaceName} · ` : ""}{saveLabel(saveMode)}</span>
        </div>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Scenario 1</div>
            <h2 className="mt-2 text-2xl font-semibold">Hire someone</h2>
            <p className="mt-2 text-sm leading-6 text-[#795f4f]">Add a fictional employee and confirm the payroll path recognizes whether they are salaried or hourly.</p>
            <form onSubmit={addHire} className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Employee name<input required value={hireName} onChange={(e) => setHireName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" placeholder="Taylor Morgan" /></label>
              <label className="block text-sm font-medium">Pay type<select value={hireType} onChange={(e) => setHireType(e.target.value as "Salary" | "Hourly")} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5"><option>Hourly</option><option>Salary</option></select></label>
              <label className="block text-sm font-medium">{hireType === "Hourly" ? "Hourly rate" : "Annual salary"}<input value={hireRate} onChange={(e) => setHireRate(e.target.value)} type="number" step="0.01" min="0.01" className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
              <button className="w-full rounded-xl bg-[#5a321f] px-4 py-3 font-semibold text-white">Add UAT hire</button>
            </form>
          </div>

          <div className="rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Scenario 2</div>
            <h2 className="mt-2 text-2xl font-semibold">Make a change</h2>
            <p className="mt-2 text-sm leading-6 text-[#795f4f]">Test a payroll rate or salary change without rebuilding the employee.</p>
            <form onSubmit={applyRateChange} className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Employee<select value={changeEmployee} onChange={(e) => setChangeEmployee(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label className="block text-sm font-medium">New rate / salary<input value={changeRate} onChange={(e) => setChangeRate(e.target.value)} type="number" step="0.01" min="0.01" className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5" /></label>
              <button className="w-full rounded-xl bg-[#5a321f] px-4 py-3 font-semibold text-white">Apply UAT change</button>
            </form>
          </div>

          <div className="rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Scenario 3</div>
            <h2 className="mt-2 text-2xl font-semibold">Enter timesheets</h2>
            <p className="mt-2 text-sm leading-6 text-[#795f4f]">Hourly employees need time before payroll can be marked ready.</p>
            <div className="mt-5 space-y-4">
              {hourlyEmployees.map((employee) => {
                const row = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
                return <div key={employee.id} className="rounded-2xl border border-[#e4d6ca] bg-white p-4"><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#806858]">Hourly · ${employee.rate.toFixed(2)}</div><div className="mt-3 grid grid-cols-3 gap-2">{(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-[11px] font-semibold capitalize text-[#7a6252]">{field}<input value={row[field]} onChange={(e) => updateTime(employee.id, field, e.target.value)} type="number" min="0" step="0.25" className="mt-1 w-full rounded-lg border border-[#d8c8ba] px-2 py-2 text-sm" /></label>)}</div></div>;
              })}
              <button disabled={!allHourlyHaveTime} onClick={() => { setReady(true); setNotice("Hourly time is marked ready for this UAT payroll run."); }} className="w-full rounded-xl bg-[#5a321f] px-4 py-3 font-semibold text-white disabled:opacity-40">Mark time ready</button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[26px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">UAT pay population</h2><p className="mt-1 text-sm text-[#795f4f]">Confirm that hires, changes and timesheets remain visible before moving into the guided payroll run.</p></div><div className={`rounded-full px-4 py-2 text-sm font-semibold ${ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>{ready ? "Time ready" : "Time needs review"}</div></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[#e5d8cc] text-xs uppercase tracking-wider text-[#8b7464]"><tr><th className="py-3">Employee</th><th>Pay type</th><th>Current rate</th><th>Status</th><th>Time</th></tr></thead><tbody>{employees.map((employee) => { const time = timesheets[employee.id]; return <tr key={employee.id} className="border-b border-[#efe5dc]"><td className="py-4 font-semibold">{employee.name}<div className="text-xs font-normal text-[#8c7464]">{employee.id}</div></td><td>{employee.payType}</td><td>{employee.payType === "Hourly" ? `$${employee.rate.toFixed(2)}/hr` : `$${employee.rate.toLocaleString("en-CA")}/yr`}</td><td>{employee.status}</td><td>{employee.payType === "Hourly" && time ? `${time.regular} reg · ${time.overtime} OT · ${time.vacation} vac` : "Carries forward"}</td></tr>; })}</tbody></table></div>
          <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Continue to guided payroll</button><button onClick={resetUat} className="rounded-xl border border-[#d6c6b8] px-5 py-3 font-semibold">Reset UAT data</button></div>
        </section>
      </div>
    </main>
  );
}
