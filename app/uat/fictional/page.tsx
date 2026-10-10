"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FICTIONAL_PILOT_EXPECTATIONS,
  FICTIONAL_PILOT_PROFILE_KEY,
  FICTIONAL_PILOT_PROFILE,
  FICTIONAL_PILOT_STATE,
} from "@/lib/payroll/pilot-fictional-scenario";
import { PILOT_RUN_KEY, PILOT_UAT_STORAGE_KEY } from "@/lib/payroll/pilot-uat";

const paymentStorageKey = "coffee-payroll:pilot-payments";
const paymentMethodStorageKey = "coffee-payroll:pilot-payment-methods";
const guidedProgressKey = `coffee-payroll:guided-payroll:${PILOT_RUN_KEY}`;
const legacyGuidedProgressKey = "coffee-payroll:guided-payroll:2026-17-pilot";
const emptyPayments = { approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {}, completedAt: null };

export default function FictionalPilotScenarioPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "device" | "error">("idle");
  const [message, setMessage] = useState("Load the fictional scenario, then run payroll exactly as a small-business owner would.");

  async function loadScenario() {
    setStatus("loading");
    setMessage("Loading Juniper Trail Coffee Co. and clearing prior pilot progress…");

    window.localStorage.setItem(PILOT_UAT_STORAGE_KEY, JSON.stringify(FICTIONAL_PILOT_STATE));
    window.localStorage.setItem(FICTIONAL_PILOT_PROFILE_KEY, JSON.stringify(FICTIONAL_PILOT_PROFILE));
    window.localStorage.setItem(paymentStorageKey, JSON.stringify(emptyPayments));
    window.localStorage.removeItem(paymentMethodStorageKey);
    window.sessionStorage.removeItem(guidedProgressKey);
    window.sessionStorage.removeItem(legacyGuidedProgressKey);

    let workspaceSaved = false;
    try {
      const workspaceResponse = await fetch("/api/pilot/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: FICTIONAL_PILOT_PROFILE, state: FICTIONAL_PILOT_STATE }),
      });
      workspaceSaved = workspaceResponse.ok;

      if (workspaceSaved) {
        const paymentsResponse = await fetch("/api/pilot/payments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: true }),
        });
        if (!paymentsResponse.ok) {
          setStatus("error");
          setMessage("The fictional payroll loaded, but the prior hosted payment state could not be reset. Open the payment screen and confirm it is not already approved before testing.");
          return;
        }
      }
    } catch {
      workspaceSaved = false;
    }

    if (workspaceSaved) {
      setStatus("ready");
      setMessage("Scenario loaded into your pilot workspace. Start at Changes and follow the six-step payroll flow.");
    } else {
      setStatus("device");
      setMessage("Hosted workspace storage is unavailable, so the scenario was loaded on this device. The guided workflow can still be reviewed locally.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] px-4 py-7 text-[#1a2930] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#647087]">Coffee Payroll pilot</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Fictional payroll test</h1>
            <p className="mt-2 text-sm text-[#4c5c68]">{FICTIONAL_PILOT_PROFILE.businessName} · Alberta · Biweekly</p>
          </div>
          <button onClick={() => router.push("/uat")} className="rounded-xl border border-[#d9e3f2] bg-[#ffffff] px-4 py-2 text-sm font-semibold">Back to UAT hub</button>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#dde6eb] bg-[#ffffff] p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold">What this scenario tests</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ScenarioCard title="Avery Chen" detail="Salaried employee. Regular salary should carry forward automatically." />
            <ScenarioCard title="Noah Williams" detail="Hourly employee. Rate changes from $29.50 to $31.00 on August 24. Test allocation: 40 regular hours before the change; 40 regular plus 2.5 overtime hours from August 24." />
            <ScenarioCard title="Priya Singh" detail="Salaried employee. Clean, routine employee for comparison." />
            <ScenarioCard title="Liam Martin" detail="Hourly employee leaving August 28. This first validated UAT includes regular earnings plus a $120 reimbursement; accrued vacation payout is reserved for the later irregular-payment test." />
          </div>

          <div className="mt-6 rounded-2xl border border-[#e6c566] bg-[#fff8e7] p-5 text-sm leading-6 text-[#7a5d18]">
            <strong>Expected friction is intentional.</strong> Noah&apos;s rate change should stop approval until his hours are allocated to the old and new rates. Liam should be visibly identified as leaving and should carry final-pay amounts into Review.
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={loadScenario} disabled={status === "loading"} className="rounded-xl bg-[#1557d8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {status === "loading" ? "Loading scenario…" : "Load fictional test"}
            </button>
            {(status === "ready" || status === "device") && (
              <button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#1557d8] px-5 py-3 text-sm font-semibold text-white">Start Run Payroll</button>
            )}
          </div>
          <p className={`mt-4 text-sm ${status === "error" ? "font-semibold text-[#8a4427]" : "text-[#4c5c68]"}`}>{message}</p>
        </section>

        <section className="mt-5 rounded-2xl border border-[#dde6eb] bg-[#ffffff] p-6">
          <h2 className="text-lg font-semibold">Pass criteria</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[#4c5c68]">
            <li>1. Changes shows exactly {FICTIONAL_PILOT_EXPECTATIONS.changedEmployees.length} employees requiring attention: Noah and Liam.</li>
            <li>2. Employees shows all {FICTIONAL_PILOT_EXPECTATIONS.employeesInRun} employees and every employee card is clickable.</li>
            <li>3. Hours & pay shows {FICTIONAL_PILOT_EXPECTATIONS.hourlyEmployees} hourly employees and keeps approval blocked until Noah&apos;s rate split is completed.</li>
            <li>4. Review shows Avery and Priya as routine salary carry-forward, Noah&apos;s split-rate pay, and Liam&apos;s final-pay status and reimbursement.</li>
            <li>5. Approve & pay does not send money. After approval, each employee payment must be confirmed separately.</li>
            <li>6. Done appears only after all employee payments are confirmed.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

function ScenarioCard({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-[#dde6eb] bg-white p-5"><h3 className="font-semibold text-[#1a2930]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#4c5c68]">{detail}</p></div>;
}
