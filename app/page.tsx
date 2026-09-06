import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, CheckCircle2, Coffee, FileText, ShieldCheck, Users } from "lucide-react";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";

const steps = [
  ["1", "Changes", "Tell us what changed since last payroll."],
  ["2", "Employees", "Confirm who is being paid this time."],
  ["3", "Hours & pay", "Review hourly time and regular pay."],
  ["4", "Review", "See the payroll clearly before approval."],
  ["5", "Approve & pay", "Approve the run and send employee payments."],
  ["6", "Done", "Keep the record and move on with your day."],
] as const;

export default async function HomePage() {
  const user = await getCoffeePayrollUser();
  if (user) redirect("/guided-payroll");

  return (
    <main className="min-h-screen bg-[#f7efe6] text-[#332118]">
      <header className="border-b border-[#e6d8ca] bg-[#fffaf5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#5a321f] text-white shadow-sm"><Coffee className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-semibold tracking-tight">Coffee Payroll</span>
              <span className="block text-[9px] uppercase tracking-[0.28em] text-[#8a6d5a]">stress free payroll</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-[#6f5647] md:flex" aria-label="Public navigation">
            <a href="#how-it-works" className="hover:text-[#332118]">How it works</a>
            <a href="#why-coffee" className="hover:text-[#332118]">Why Coffee Payroll</a>
            <a href="#pricing" className="hover:text-[#332118]">Pricing</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login?mode=signin" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#5a321f] transition hover:bg-[#f4e7da] sm:px-4">Sign in</Link>
            <Link href="/login?mode=signup" className="rounded-xl bg-[#5a321f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#452518]">Get started</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-[45%] bg-gradient-to-bl from-[#ead4bb] via-[#f2e3d2] to-transparent lg:block" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc9b5] bg-[#fff9f3] px-3 py-1.5 text-xs font-semibold text-[#74513c]"><BadgeCheck className="h-4 w-4" /> Canadian payroll, made for small business</div>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Payroll without the payroll headache.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#71594a] sm:text-xl">Coffee Payroll guides you through each pay, one clear decision at a time. No giant payroll department required.</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?mode=signup" className="inline-flex items-center justify-center rounded-xl bg-[#b94f16] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9f4010]">Start with Coffee Payroll →</Link>
              <Link href="/login?mode=signin" className="inline-flex items-center justify-center rounded-xl border border-[#cfb8a5] bg-[#fffaf5] px-6 py-3.5 text-sm font-semibold text-[#4e3020] transition hover:bg-white">Already a customer? Sign in</Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#806858]">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#5d7a47]" /> Guided six-step payroll</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#5d7a47]" /> Clear review before approval</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#5d7a47]" /> Built for Canadian small business</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -left-8 -top-8 h-36 w-36 rounded-full bg-[#d99b63]/20 blur-2xl" />
            <div className="relative rounded-[32px] border border-[#ddc7b3] bg-[#fffaf5] p-6 shadow-[0_30px_80px_rgba(81,48,27,0.16)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[#967663]">Your next payroll</div><div className="mt-1 text-2xl font-semibold">You’re in control.</div></div>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ead7c4] text-3xl">☕</div>
              </div>
              <div className="mt-7 space-y-3">
                {steps.slice(0, 4).map(([number, title, detail], index) => (
                  <div key={title} className="flex items-center gap-4 rounded-2xl border border-[#eadfd4] bg-white px-4 py-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${index === 0 ? "bg-[#5a321f] text-white" : "bg-[#f3e6da] text-[#6e4a35]"}`}>{number}</span>
                    <div className="min-w-0 flex-1"><div className="font-semibold">{title}</div><div className="mt-0.5 text-xs text-[#816a5b]">{detail}</div></div>
                    <span className="text-[#b39a87]">›</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-[#edf3e8] px-4 py-3 text-sm text-[#4d663f]"><strong>Nothing hidden.</strong> You review the payroll before anything is approved.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[#eadfd4] bg-[#fffaf5]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18">
          <div className="max-w-2xl"><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">How it works</div><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Six steps. One payroll. No maze.</h2><p className="mt-3 text-sm leading-6 text-[#765d4e]">Coffee Payroll keeps the owner focused on what matters now, while the detailed payroll machinery stays in the background.</p></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map(([number, title, detail]) => (
              <article key={title} className="rounded-2xl border border-[#e3d5c9] bg-white p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f0dfd0] text-sm font-bold text-[#633c27]">{number}</span>
                <h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#806858]">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why-coffee" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-3xl border border-[#e0cdbc] bg-[#fffaf5] p-6"><ShieldCheck className="h-7 w-7 text-[#5a321f]" /><h3 className="mt-4 text-xl font-semibold">Built for Canada</h3><p className="mt-2 text-sm leading-6 text-[#765d4e]">Designed around Canadian payroll concepts, statutory deductions and employer obligations.</p></article>
          <article className="rounded-3xl border border-[#e0cdbc] bg-[#fffaf5] p-6"><Users className="h-7 w-7 text-[#5a321f]" /><h3 className="mt-4 text-xl font-semibold">Made for owners</h3><p className="mt-2 text-sm leading-6 text-[#765d4e]">Plain language and guided decisions instead of a screen full of payroll codes.</p></article>
          <article className="rounded-3xl border border-[#e0cdbc] bg-[#fffaf5] p-6"><FileText className="h-7 w-7 text-[#5a321f]" /><h3 className="mt-4 text-xl font-semibold">A record you can follow</h3><p className="mt-2 text-sm leading-6 text-[#765d4e]">Review, approval and payment checkpoints are kept distinct so the payroll story stays clear.</p></article>
        </div>
      </section>

      <section id="pricing" className="border-t border-[#eadfd4] bg-[#4d2b1b] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div><div className="text-sm font-semibold text-[#efd4bf]">Simple enough to start.</div><h2 className="mt-1 text-3xl font-semibold tracking-tight">Ready when payroll is.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#e4cdbd]">We’re still refining pilot pricing. Create an account to explore the Coffee Payroll workflow without pretending there are hidden commitments.</p></div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row"><Link href="/login?mode=signup" className="rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-[#4d2b1b]">Create account</Link><Link href="/login?mode=signin" className="rounded-xl border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white">Sign in</Link></div>
        </div>
      </section>

      <footer className="bg-[#382116] px-5 py-6 text-center text-xs text-[#cdb6a7]">Coffee Payroll · stress free payroll · Canadian small-business pilot</footer>
    </main>
  );
}
