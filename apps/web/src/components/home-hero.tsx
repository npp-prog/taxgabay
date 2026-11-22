"use client";

import Link from "next/link";
import { SampleSchedule } from "@/components/sample-schedule";
import { buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

export function HomeHero() {
  const { t } = useLocale();
  return (
    <section className="grid items-center gap-10 py-6 lg:grid-cols-[1.05fr_1fr] lg:py-10">
      <div className="space-y-6">
        <p className="form-label">For Philippine taxpayers · BIR, in plain language</p>
        <h1 className="font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-[3.4rem]">{t.home.title}</h1>
        <p className="max-w-[58ch] text-lg leading-relaxed text-muted-foreground">{t.home.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/profile" className={buttonVariants({ size: "lg" })}>
            {t.home.start} →
          </Link>
          <Link href="/calculators" className={buttonVariants({ size: "lg", variant: "outline" })}>
            {t.home.tryCalc}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t.home.noAccount}</p>
      </div>
      <SampleSchedule />
    </section>
  );
}

export function HomeFootnote() {
  const { t } = useLocale();
  return <>{t.home.footnote}</>;
}
