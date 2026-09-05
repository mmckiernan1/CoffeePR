"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

export function PayrollRouteBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace");

  useEffect(() => {
    if (pathname !== "/" || !workspace || !workspaceLabels[workspace]) return;

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
  }, [pathname, router, workspace]);

  useEffect(() => {
    if (pathname !== "/" || workspace) return;

    function intercept(event: MouseEvent) {
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
  }, [pathname, router, workspace]);

  return null;
}
