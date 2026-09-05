import type { Metadata } from "next";
import "./globals.css";
import { PayrollRouteBridge } from "@/components/comcheq/payroll-route-bridge";

export const metadata: Metadata = {
  title: "Comcheq Payroll",
  description: "A violet-and-green Canadian fintech payroll workflow with employee lifecycle, Alberta-ready statements, reports and accountant exports.",
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
