"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode") === "signin" ? "signin" : "signup";
  const [mode, setMode] = useState<"signin" | "signup">(requestedMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(searchParams.get("error"));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Unable to continue.");

      if (payload.confirmationRequired) {
        setMessage("Check your email to confirm your Coffee Payroll account, then come back and sign in.");
        setMode("signin");
        return;
      }

      router.replace(mode === "signup" ? "/setup" : "/guided-payroll");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  function social(provider: "google" | "microsoft" | "apple") {
    window.location.href = `/api/auth/oauth/${provider}`;
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-8 text-[#332118] sm:px-6">
      <div className="mx-auto mb-5 flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold text-[#5a321f]">← Coffee Payroll</Link>
        <Link href={mode === "signin" ? "/login?mode=signup" : "/login?mode=signin"} className="text-sm font-semibold text-[#5a321f]">{mode === "signin" ? "Create account" : "Sign in"}</Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl overflow-hidden rounded-[32px] border border-[#decdbd] bg-[#fffaf5] shadow-[0_30px_90px_rgba(72,42,24,0.14)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#ead8c5] p-12 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5a321f] text-2xl text-white">☕</div>
              <div>
                <div className="text-3xl font-semibold tracking-tight">Coffee Payroll</div>
                <div className="mt-1 text-xs tracking-[0.32em] text-[#846755]">stress free payroll</div>
              </div>
            </div>

            <h1 className="mt-16 max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em]">Good people build great businesses.</h1>
            <p className="mt-5 max-w-lg text-xl leading-8 text-[#6c5140]">We’ll help take the stress out of payroll, one simple step at a time.</p>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/45 p-6 backdrop-blur-sm">
            <div className="text-sm font-semibold text-[#4b2d1e]">Built for Canadian small business</div>
            <p className="mt-2 text-sm leading-6 text-[#725747]">Your business workspace keeps payroll, employees, reports and remittances together. Invite trusted help later without sharing your login.</p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div>
                <div>
                  <div className="text-2xl font-semibold">Coffee Payroll</div>
                  <div className="mt-1 text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll</div>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#786151]">{mode === "signup" ? "Start your secure Coffee Payroll workspace." : "Sign in to continue your payroll."}</p>

            <div className="mt-7 grid gap-3">
              <button type="button" onClick={() => social("google")} className="rounded-xl border border-[#d8c8ba] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff8f1]">Continue with Google</button>
              <button type="button" onClick={() => social("microsoft")} className="rounded-xl border border-[#d8c8ba] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff8f1]">Continue with Microsoft</button>
              <button type="button" onClick={() => social("apple")} className="rounded-xl border border-[#d8c8ba] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff8f1]">Continue with Apple</button>
            </div>

            <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#a18b7a]"><span className="h-px flex-1 bg-[#e0d3c7]" />or use email<span className="h-px flex-1 bg-[#e0d3c7]" /></div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm font-medium">Email address
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-4 py-3 outline-none ring-[#8e5b3c] transition focus:ring-2" placeholder="you@yourbusiness.ca" />
              </label>
              <label className="block text-sm font-medium">Password
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required className="mt-2 w-full rounded-xl border border-[#d8c8ba] bg-white px-4 py-3 outline-none ring-[#8e5b3c] transition focus:ring-2" placeholder="At least 8 characters" />
              </label>

              {message && <div className="rounded-xl border border-[#e4c5ad] bg-[#fff4e8] px-4 py-3 text-sm leading-5 text-[#71452f]">{message}</div>}

              <button disabled={busy} className="w-full rounded-xl bg-[#5a321f] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#452518] disabled:cursor-wait disabled:opacity-60">{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}</button>
            </form>

            <p className="mt-6 text-center text-sm text-[#786151]">
              {mode === "signup" ? "Already have an account?" : "New to Coffee Payroll?"}{" "}
              <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(null); }} className="font-semibold text-[#5a321f] underline-offset-4 hover:underline">{mode === "signup" ? "Sign in" : "Create one"}</button>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-[#9b8879]">Your payroll login is personal to you. Business access and invited team members are managed separately.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
