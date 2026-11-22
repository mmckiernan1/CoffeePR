"use client";
import { FICTIONAL_PILOT_PROFILE_KEY } from "@/lib/payroll/pilot-fictional-scenario";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pilotHourlyRateForSegment, pilotHourlyRateSegmentDates } from "@/lib/payroll/pilot-hourly-rate-split";
import {
  PILOT_RUN_PERIOD,
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotHourlyRateSplitNeeded,
  pilotHourlyRateSplitReady,
  type PilotTimesheet,
  type PilotUatEmployee,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

type SaveMode = "loading" | "workspace" | "saving" | "device" | "error";

export default function GuidedTimeEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEmployeeId = searchParams.get("employee");
  const [state, setState] = useState<PilotUatState | null>(null);
  const [businessName, setBusinessName] = useState("My business");
  const [mode, setMode] = useState<SaveMode>("loading");
  const [notice, setNotice] = useState("Loading this payroll’s hours…");
  const [showValidation, setShowValidation] = useState(false);
  const hydrated = useRef(false);
  const cloudSave = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hourly = useMemo(() => state?.employees.filter((employee) => employee.payType === "Hourly" && employee.status !== "Terminated") ?? [], [state]);
  const salaryCount = useMemo(() => state?.employees.filter((employee) => employee.payType === "Salary" && employee.status !== "Terminated").length ?? 0, [state]);
  const completeRows = useMemo(() => hourly.filter((employee) => {
    const row = state?.timesheets[employee.id];
    return Boolean(row && row.regular >= 0 && row.overtime >= 0 && row.vacation >= 0 && pilotHourlyRateSplitReady(employee, row));
  }).length, [hourly, state]);
  const splitCount = useMemo(() => hourly.filter(pilotHourlyRateSplitNeeded).length, [hourly]);
  const orderedHourly = useMemo(() => {
    if (!requestedEmployeeId) return hourly;
    return [...hourly].sort((left, right) => {
      if (left.id === requestedEmployeeId) return -1;
      if (right.id === requestedEmployeeId) return 1;
      return 0;
    });
  }, [hourly, requestedEmployeeId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (!response.ok) throw new Error("workspace unavailable");
        const payload = await response.json();
        if (cancelled) return;
        setState(payload.state);
        setBusinessName(payload.profile?.businessName ?? "My business");
        cloudSave.current = true;
        setMode("workspace");
        setNotice("Only hourly employees are shown here. Review what is already entered and change only what is different.");
      } catch {
        let next = PILOT_STARTER_STATE;
        try {
          const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
          if (raw) next = JSON.parse(raw) as PilotUatState;
        } catch { /* use fictional fallback */ }
        if (!cancelled) {
          const localProfile = window.localStorage.getItem(FICTIONAL_PILOT_PROFILE_KEY);
          if (localProfile) setBusinessName(JSON.parse(localProfile).businessName);
          setState(next);
          cloudSave.current = false;
          setMode("device");
          setNotice("Hours are saved on this device for this test.");
        }
      } finally {
        hydrated.current = true;
      }
    }
    load();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!hydrated.current || !state) return;
    window.localStorage.setItem(PILOT_UAT_STORAGE_KEY, JSON.stringify(state));
    if (!cloudSave.current) return;
    if (timer.current) clearTimeout(timer.current);
    setMode("saving");
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/pilot/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) throw new Error("save failed");
        setMode("workspace");
      } catch {
        cloudSave.current = false;
        setMode("error");
        setNotice("Coffee Payroll could not sync your latest hours, but they remain saved on this device.");
      }
    }, 500);
  }, [state]);

  function updateTime(id: string, field: keyof Pick<PilotTimesheet, "regular" | "overtime" | "vacation">, value: string) {
    const number = Number(value);
    setState((current) => current ? {
      ...current,
      ready: false,
      timesheets: {
        ...current.timesheets,
        [id]: { ...(current.timesheets[id] ?? { regular: 0, overtime: 0, vacation: 0 }), [field]: Number.isFinite(number) && number >= 0 ? number : 0 },
      },
    } : current);
    setNotice("Hours updated. Coffee Payroll will recalculate before review.");
  }

  function splitRows(employee: PilotUatEmployee, row: PilotTimesheet) {
    const dates = pilotHourlyRateSegmentDates(employee, PILOT_RUN_PERIOD);
    const existing = row.rateSplits ?? [];
    return dates.map((effectiveFrom) => existing.find((item) => item.effectiveFrom === effectiveFrom) ?? { effectiveFrom, regular: 0, overtime: 0, vacation: 0 });
  }

  function updateSplitTime(employee: PilotUatEmployee, effectiveFrom: string, field: "regular" | "overtime" | "vacation", value: string) {
    const number = Number(value);
    setState((current) => {
      if (!current) return current;
      const row = current.timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
      const allocationTarget = row.allocationTarget ?? { regular: row.regular, overtime: row.overtime, vacation: row.vacation };
      const splits = splitRows(employee, row).map((item) => item.effectiveFrom === effectiveFrom
        ? { ...item, [field]: Number.isFinite(number) && number >= 0 ? number : 0 }
        : item);
      const totals = splits.reduce((result, item) => ({
        regular: result.regular + item.regular,
        overtime: result.overtime + item.overtime,
        vacation: result.vacation + item.vacation,
      }), { regular: 0, overtime: 0, vacation: 0 });
      return {
        ...current,
        ready: false,
        timesheets: { ...current.timesheets, [employee.id]: { ...totals, allocationTarget, rateSplits: splits } },
      };
    });
    setNotice("Rate-split hours updated. Coffee Payroll will apply each rate to the correct part of the pay period.");
  }

  function fillFictionalNoahAllocation(employee: PilotUatEmployee) {
    if (businessName !== "Juniper Trail Coffee Co." || employee.id !== "EMP-0002") return;
    setState((current) => {
      if (!current) return current;
      const row = current.timesheets[employee.id];
      const target = row?.allocationTarget ?? (row ? { regular: row.regular, overtime: row.overtime, vacation: row.vacation } : null);
      const dates = pilotHourlyRateSegmentDates(employee, PILOT_RUN_PERIOD);
      if (!target || target.regular !== 80 || target.overtime !== 2.5 || target.vacation !== 0
          || dates.length !== 2 || dates[1] !== "2026-08-24") return current;
      return {
        ...current,
        ready: false,
        timesheets: {
          ...current.timesheets,
          [employee.id]: {
            ...row,
            regular: 80,
            overtime: 2.5,
            vacation: 0,
            allocationTarget: target,
            rateSplits: [
              { effectiveFrom: dates[0], regular: 40, overtime: 0, vacation: 0 },
              { effectiveFrom: dates[1], regular: 40, overtime: 2.5, vacation: 0 },
            ],
          },
        },
      };
    });
    setShowValidation(false);
    setNotice("Fictional example loaded: 40 hours before the rate change, 40 regular and 2.5 overtime hours after. Please review and confirm.");
  }

  async function markReady() {
    if (!state) return;
    if (completeRows !== hourly.length) {
      setShowValidation(true);
      setNotice("One or more hourly employees still need their hours allocated. Check the coloured allocation summary below each employee.");
      return;
    }
    setShowValidation(false);
    const readyState = { ...state, ready: true };
    if (timer.current) clearTimeout(timer.current);
    setState(readyState);
    window.localStorage.setItem(PILOT_UAT_STORAGE_KEY, JSON.stringify(readyState));

    if (cloudSave.current) {
      setMode("saving");
      try {
        const response = await fetch("/api/pilot/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: readyState }),
        });
        if (!response.ok) throw new Error("save failed");
        setMode("workspace");
      } catch {
        setMode("error");
        setNotice("Coffee Payroll saved your hours on this device, but could not sync them. Try again before continuing.");
        return;
      }
    }

    router.push("/guided-payroll");
  }

  if (!state) return <main className="coffee-payroll-readable min-h-screen bg-[#f7efe6] px-4 py-8 text-[#332118]"><div className="mx-auto max-w-4xl rounded-2xl border border-[#decdbd] bg-[#fffdf9] p-6">{notice}</div></main>;

  return (
    <main className="coffee-payroll-readable min-h-screen bg-[#f7efe6] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="block h-12 w-12 rounded-2xl bg-[#fff7ef]" style={{ background: "center / contain no-repeat url('/favicon.svg')" }} role="img" aria-label="Coffee Payroll cup" /><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#795f4f]">stress free payroll · hours & pay</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#e5d1bd] bg-[#fffdf9] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <section className="mt-7 rounded-[28px] border border-[#decdbd] bg-[#fffdf9] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#795f4f]">Step 3 · Hours & pay</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-semibold">{hourly.length === 0 ? "No hours to enter this pay" : `Review ${hourly.length} hourly ${hourly.length === 1 ? "employee" : "employees"}`}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">{salaryCount > 0 ? `${salaryCount} salaried ${salaryCount === 1 ? "employee is" : "employees are"} already carried forward automatically. ` : ""}Check the regular, overtime and vacation hours already shown. Change only what is different.</p></div>
            <div className="rounded-2xl bg-[#edf3ff] px-4 py-3 text-right"><div className="text-xs text-[#795f4f]">{businessName}</div><div className="mt-1 text-sm font-semibold">{state.ready ? "✓ Hours ready" : `${completeRows} of ${hourly.length} checked`}</div></div>
          </div>

          {splitCount > 0 && <div className="mt-5 rounded-2xl border border-[#decdbd] bg-[#fff6ec] px-5 py-4 text-sm leading-6 text-[#714a32]"><strong>{splitCount} hourly employee{splitCount === 1 ? " has" : "s have"} a rate change during this pay period.</strong> Their hours are split below so Coffee Payroll can pay the hours before and after the change at the correct rates.</div>}

          <div className="mt-6 space-y-4">
            {orderedHourly.map((employee) => {
              const row = state.timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
              const needsSplit = pilotHourlyRateSplitNeeded(employee);
              const segments = needsSplit ? splitRows(employee, row) : [];
              const target = row.allocationTarget ?? { regular: row.regular, overtime: row.overtime, vacation: row.vacation };
              const allocated = segments.reduce((sum, segment) => ({
                regular: sum.regular + segment.regular,
                overtime: sum.overtime + segment.overtime,
                vacation: sum.vacation + segment.vacation,
              }), { regular: 0, overtime: 0, vacation: 0 });
              const splitReady = pilotHourlyRateSplitReady(employee, row);
              const formatHours = (value: number) => Number(value.toFixed(3)).toLocaleString("en-CA");
              const exampleAvailable = businessName === "Juniper Trail Coffee Co."
                && employee.id === "EMP-0002" && target.regular === 80 && target.overtime === 2.5
                && target.vacation === 0 && segments.length === 2
                && segments[1].effectiveFrom === "2026-08-24";
              const requested = employee.id === requestedEmployeeId;
              return <div key={employee.id} className={`rounded-2xl border bg-white p-5 ${requested ? "border-[#8fb0e8] ring-2 ring-[#dbe8fb]" : "border-[#decdbd]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#795f4f]">Hourly · ${employee.rate.toFixed(2)}/hr{employee.status === "New hire" ? " · New hire" : employee.status === "Terminating" ? " · Leaving" : ""}</div></div><div className="flex flex-wrap items-center gap-2">{requested && <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-semibold text-[#1557d8]">Selected</span>}<span className={`rounded-full px-3 py-1 text-xs font-semibold ${needsSplit ? "bg-[#fff6ec] text-[#714a32]" : "bg-[#f1f6ed] text-[#5f7654]"}`}>{needsSplit ? "Rate changed this pay" : "Review hours"}</span></div></div>

                {needsSplit && <div className="mt-4 rounded-xl border border-[#decdbd] bg-[#fffaf5] px-4 py-3 text-xs leading-5 text-[#466985]"><strong>Allocate exactly {row.allocationTarget?.regular ?? row.regular} regular and {row.allocationTarget?.overtime ?? row.overtime} overtime hours across the two rate periods.</strong> Coffee Payroll will keep this employee incomplete until the allocation matches the original hours.{employee.changeNote && <span className="mt-1 block">{employee.changeNote}</span>}</div>}
                {!needsSplit ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-xs font-semibold text-[#795f4f]">{field === "regular" ? "Regular hours" : field === "overtime" ? "Overtime hours" : "Vacation hours"}<input value={row[field]} onChange={(event) => updateTime(employee.id, field, event.target.value)} type="number" min="0" step="0.25" className="mt-1.5 w-full rounded-xl border border-[#decdbd] bg-white px-3 py-2.5 text-base font-normal" /></label>)}
                </div> : <div className="mt-4 space-y-3">{segments.map((segment, index) => {
                  const rate = pilotHourlyRateForSegment(employee, segment.effectiveFrom);
                  const nextDate = segments[index + 1]?.effectiveFrom;
                  return <div key={segment.effectiveFrom} className="rounded-xl border border-[#eadfd4] bg-[#fffdf9] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold">{index === 0 && nextDate ? `Before ${new Date(`${nextDate}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : `From ${new Date(`${segment.effectiveFrom}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}</div><div className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#795f4f]">${rate.toFixed(2)}/hr</div></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-xs font-semibold text-[#795f4f]">{field === "regular" ? "Regular hours" : field === "overtime" ? "Overtime hours" : "Vacation hours"}<input value={segment[field]} onChange={(event) => updateSplitTime(employee, segment.effectiveFrom, field, event.target.value)} type="number" min="0" step="0.25" className="mt-1.5 w-full rounded-xl border border-[#decdbd] bg-white px-3 py-2.5 text-base font-normal" /></label>)}</div></div>;
                })}</div>}
                {needsSplit && (
                  <div aria-live="polite" className={`mt-4 rounded-xl border px-4 py-4 ${splitReady ? "border-[#d8e5ce] bg-[#f4faf1] text-[#4f6944]" : "border-[#e6c566] bg-[#fff6ec] text-[#714a32]"}`}>
                    <p className="font-semibold">{splitReady ? "✓ Rate-change hours balance" : "Hours still need to balance before continuing"}</p>
                    <p className="mt-2 leading-6">
                      Regular: <strong>{formatHours(allocated.regular)} of {formatHours(target.regular)}</strong> hours
                      {" · "}Overtime: <strong>{formatHours(allocated.overtime)} of {formatHours(target.overtime)}</strong> hours
                      {" · "}Vacation: <strong>{formatHours(allocated.vacation)} of {formatHours(target.vacation)}</strong> hours
                    </p>
                    {!splitReady && <p className="mt-2">The hours in both rate periods must add up to the original totals. You can keep editing; every change saves automatically. Then select “Hours look right”.</p>}
                    {exampleAvailable && !splitReady && (
                      <button type="button" onClick={() => fillFictionalNoahAllocation(employee)}
                        className="mt-3 rounded-xl border border-[#9fb5d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1557d8] hover:bg-[#edf3ff]">
                        Use the fictional example: 40 + 40 regular, 2.5 overtime
                      </button>
                    )}
                  </div>
                )}
              </div>;
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-[#d8e5ce] bg-[#f4faf1] px-5 py-4 text-sm text-[#4f6944]">Salaried employees carry forward automatically. For hourly employees, change only the hours that are different.</div>

          {completeRows !== hourly.length && (
            <p className="mt-5 rounded-xl border border-[#decdbd] bg-[#fffaf5] px-4 py-3 text-sm leading-6 text-[#714a32]" role={showValidation ? "alert" : "status"} id="hours-readiness-message">
              {showValidation ? notice : `${hourly.length - completeRows} hourly ${hourly.length - completeRows === 1 ? "employee still needs" : "employees still need"} a complete hours check.`}
              {" "}Review the highlighted allocation totals above, then confirm.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd4] pt-5">
            <span className="text-xs text-[#795f4f]">{mode === "workspace" ? "Saved" : mode === "saving" ? "Saving hours…" : mode === "device" ? "Saved on this device" : mode === "error" ? "Save needs attention" : "Loading…"}</span>
            <button type="button" onClick={state.ready ? () => router.push("/guided-payroll") : markReady} aria-describedby={completeRows !== hourly.length ? "hours-readiness-message" : undefined}
              className="min-h-11 rounded-xl bg-[#1557d8] px-6 py-3 font-semibold text-white hover:bg-[#0f47b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1557d8]">
              {state.ready ? "Continue to review" : "Hours look right"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
