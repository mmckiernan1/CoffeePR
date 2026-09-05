"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const steps = ["Business", "Payroll", "Employees", "Ready"] as const;
const localProfileKey = "coffee-payroll:pilot-profile";

type PilotProfile = {
  businessName: string;
  province: string;
  frequency: string;
  employeeCount: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [province, setProvince] = useState("Alberta");
  const [frequency, setFrequency] = useState("Biweekly");
  const [employeeCount, setEmployeeCount] = useState("4");
  const [saveStatus, setSaveStatus] = useState("Loading your workspace…");
  const [cloudAvailable, setCloudAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (cancelled) return;
          const profile = payload.profile as PilotProfile;
          setBusinessName(profile.businessName === "My business" ? "" : profile.businessName);
          setProvince(profile.province || "Alberta");
          setFrequency(profile.frequency || "Biweekly");
          setEmployeeCount(String(profile.employeeCount || 4));
          setCloudAvailable(true);
          setSaveStatus("Saved to your Coffee Payroll workspace");
          return;
        }
      } catch {
        // Fall back to this browser for preview/UAT until hosted authentication is configured.
      }

      const local = window.localStorage.getItem(localProfileKey);
      if (local) {
        try {
          const profile = JSON.parse(local) as PilotProfile;
          if (!cancelled) {
            setBusinessName(profile.businessName ?? "");
            setProvince(profile.province ?? "Alberta");
            setFrequency(profile.frequency ?? "Biweekly");
            setEmployeeCount(String(profile.employeeCount ?? 4));
          }
        } catch {
          // Ignore malformed preview state.
        }
      }
      if (!cancelled) setSaveStatus("Saved on this device · sign in for workspace sync");
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function saveProfile() {
    const profile: PilotProfile = {
      businessName: businessName.trim() || "My business",
      province,
      frequency,
      employeeCount: Math.max(1, Number(employeeCount) || 1),
    };
    window.localStorage.setItem(localProfileKey, JSON.stringify(profile));

    if (!cloudAvailable) {
      setSaveStatus("Saved on this device · sign in for workspace sync");
      return;
    }

    setSaveStatus("Saving…");
    try {
      const response = await fetch("/api/pilot/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!response.ok) throw new Error("save failed");
      setSaveStatus("Saved to your Coffee Payroll workspace");
    } catch {
      setCloudAvailable(false);
      setSaveStatus("Saved on this device · workspace sync unavailable");
    }
  }

  async function next(event?: FormEvent) {
    event?.preventDefault();
    await saveProfile();
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-8 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div>
            <div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll</div></div>
          </div>
          <div className="flex items-center gap-4"><span className="text-xs font-semibold text-[#846755]">{saveStatus}</span><button onClick={() => router.push("/")} className="text-sm font-semibold text-[#6b4a36] hover:underline">Do this later</button></div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[30px] border border-[#decdbd] bg-[#fffaf5] shadow-[0_24px_70px_rgba(72,42,24,0.12)]">
          <div className="border-b border-[#eadfd4] px-6 py-5 sm:px-10">
            <div className="grid grid-cols-4 gap-2">
              {steps.map((label, index) => <div key={label}><div className={`h-2 rounded-full ${index <= step ? "bg-[#6a3b24]" : "bg-[#eadfd4]"}`} /><div className="mt-2 text-xs font-semibold text-[#7c6353]">{index + 1}. {label}</div></div>)}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            {step === 0 && <form onSubmit={next} className="mx-auto max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight">Tell us about your business</h1>
              <p className="mt-3 text-[#745948]">We’ll use this to shape your payroll workspace. You can change it later.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium sm:col-span-2">Business name<input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-4 py-3" placeholder="Java Bean Café" /></label>
                <label className="text-sm font-medium">Province<select value={province} onChange={(e) => setProvince(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-4 py-3"><option>Alberta</option><option>British Columbia</option><option>Saskatchewan</option><option>Manitoba</option><option>Ontario</option></select></label>
                <label className="text-sm font-medium">Employees<input value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} type="number" min="1" max="100" className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-4 py-3" /></label>
              </div>
              <button className="mt-8 rounded-xl bg-[#5a321f] px-6 py-3 font-semibold text-white">Continue</button>
            </form>}

            {step === 1 && <div className="mx-auto max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight">How often do you run payroll?</h1>
              <p className="mt-3 text-[#745948]">For the pilot, employee payment stays simple and uses business e-transfer.</p>
              <div className="mt-8 grid gap-4">
                <button onClick={() => setFrequency("Weekly")} className={`rounded-2xl border p-5 text-left ${frequency === "Weekly" ? "border-[#6a3b24] bg-[#f6eadf]" : "border-[#ded0c3] bg-white"}`}><strong>Weekly</strong><div className="mt-1 text-sm text-[#796050]">Good for highly variable hourly teams.</div></button>
                <button onClick={() => setFrequency("Biweekly")} className={`rounded-2xl border p-5 text-left ${frequency === "Biweekly" ? "border-[#6a3b24] bg-[#f6eadf]" : "border-[#ded0c3] bg-white"}`}><strong>Biweekly</strong><div className="mt-1 text-sm text-[#796050]">A common small-business schedule.</div></button>
                <button onClick={() => setFrequency("Semi-monthly")} className={`rounded-2xl border p-5 text-left ${frequency === "Semi-monthly" ? "border-[#6a3b24] bg-[#f6eadf]" : "border-[#ded0c3] bg-white"}`}><strong>Semi-monthly</strong><div className="mt-1 text-sm text-[#796050]">Two predictable payrolls each month.</div></button>
              </div>
              <div className="mt-8 flex gap-3"><button onClick={() => setStep(0)} className="rounded-xl border border-[#d6c6b8] px-5 py-3 font-semibold">Back</button><button onClick={() => next()} className="rounded-xl bg-[#5a321f] px-6 py-3 font-semibold text-white">Continue</button></div>
            </div>}

            {step === 2 && <div className="mx-auto max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight">Let’s get your people ready</h1>
              <p className="mt-3 text-[#745948]">You can add employees now, or start with the UAT sample team and replace them later.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button onClick={async () => { await saveProfile(); router.push("/?workspace=employees"); }} className="rounded-2xl border border-[#d8c8ba] bg-white p-6 text-left"><strong>Add employees now</strong><p className="mt-2 text-sm text-[#745948]">Enter hires, salary or hourly rates and payroll details.</p></button>
                <button onClick={() => next()} className="rounded-2xl border border-[#d8c8ba] bg-white p-6 text-left"><strong>Use the UAT sample team</strong><p className="mt-2 text-sm text-[#745948]">Four fictional employees are ready for testing.</p></button>
              </div>
              <button onClick={() => setStep(1)} className="mt-8 rounded-xl border border-[#d6c6b8] px-5 py-3 font-semibold">Back</button>
            </div>}

            {step === 3 && <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#efe0d1] text-3xl">✓</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight">Your workspace is ready</h1>
              <p className="mt-3 text-[#745948]">{businessName || "Your business"} · {province} · {frequency} · about {employeeCount} employees</p>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#7c6555]">Next we’ll use the pilot UAT area to test hires, employee changes, timesheets and the guided payroll flow before you put real payroll through the system.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => router.push("/uat")} className="rounded-xl bg-[#5a321f] px-6 py-3 font-semibold text-white">Start pilot UAT</button><button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] px-6 py-3 font-semibold">Preview payroll</button></div>
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
