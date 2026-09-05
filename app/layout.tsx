import type { Metadata } from "next";
import "./globals.css";
import { PayrollRouteBridge } from "@/components/comcheq/payroll-route-bridge";

export const metadata: Metadata = {
  title: "Coffee Payroll",
  description: "Stress free Canadian payroll for small businesses, with a guided owner-friendly workflow for employees, pay, review and payment confirmation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <body className="antialiased">
        <PayrollRouteBridge />
        {children}
      </body>
    </html>
  );
}
