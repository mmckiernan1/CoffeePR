"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const workspaceLabels: Record<string, string[]> = {
  employees: ["Employees"],
  time: ["Time entry"],
  review: ["Current run"],
  payments: ["Pay employees"],
  reports: ["Reports & statements"],
};

function buttonText(button: HTMLButtonElement) {
  return (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim();
}

function findButton(labels: string[]) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  return buttons.find((button) => labels.some((label) => buttonText(button) === label || buttonText(button).startsWith(`${label} `)));
}

function hidePilotEftControls() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], label"));
  for (const element of candidates) {
    const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (text.includes("eft bank file") || text.includes("bank file upload") || text.includes("upload eft")) {
      element.style.display = "none";
      element.setAttribute("aria-hidden", "true");
    }
  }
}

export function PayrollRouteBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/") return;

    hidePilotEftControls();
    const observer = new MutationObserver(() => hidePilotEftControls());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    const workspace = new URLSearchParams(window.location.search).get("workspace");
    if (!workspace || !workspaceLabels[workspace]) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const target = findButton(workspaceLabels[workspace]);
      if (target) {
        window.clearInterval(timer);
        target.click();
        window.setTimeout(() => router.replace("/"), 50);
      } else if (tries >= 20) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/") return;

    function intercept(event: MouseEvent) {
      if (new URLSearchParams(window.location.search).has("workspace")) return;

      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;

      const text = buttonText(button);
      const opensCurrentRun =
        text.includes("Open pay run 17") ||
        text === "Current run 17" ||
        text.startsWith("Pay run 17");

      if (!opensCurrentRun) return;

      event.preventDefault();
      event.stopPropagation();
      router.push("/guided-payroll");
    }

    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [pathname, router]);

  return null;
}
