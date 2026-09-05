"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your sign in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") ?? "3600");
    const error = params.get("error_description") ?? params.get("error");

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!accessToken) {
      router.replace("/login?error=missing-session");
      return;
    }

    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error ?? "Unable to verify sign in.");
        window.history.replaceState({}, document.title, "/auth/callback");
        setMessage("Signed in. Opening Coffee Payroll…");
        router.replace("/");
      })
      .catch((reason: Error) => {
        router.replace(`/login?error=${encodeURIComponent(reason.message)}`);
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6efe7] px-5 text-[#321d13]">
      <div className="w-full max-w-md rounded-3xl border border-[#e2d2c3] bg-white p-8 text-center shadow-[0_24px_70px_rgba(70,40,24,0.12)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#5a321f] text-2xl text-white">☕</div>
        <h1 className="text-2xl font-semibold">Coffee Payroll</h1>
        <p className="mt-1 text-xs tracking-[0.28em] text-[#8b6f5d]">stress free payroll</p>
        <p className="mt-7 text-sm text-[#6f594b]">{message}</p>
      </div>
    </main>
  );
}
