"use client";

import Link from "next/link";
import { SampleSchedule } from "@/components/sample-schedule";
import { buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

export function HomeHero() {
  const { t } = useLocale();
  // First clause in violet, the rest in ink.
  const cut = t.home.title.indexOf(",");
  const lead = cut > 0 ? t.home.title.slice(0, cut + 1) : "";
  const rest = cut > 0 ? t.home.title.slice(cut + 1) : t.home.title;
  return (
    <section className="pt-6 text-center sm:pt-12">
      <p className="mx-auto mb-5 inline-flex rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground">For Philippine taxpayers · BIR, in plain language</p>
      <h1 className="mx-auto max-w-[22ch] font-display text-[2.3rem] font-semibold leading-[1.06] sm:text-[3.6rem]">
        {lead && <span className="text-primary">{lead}</span>}
        {rest}
      </h1>
      <p className="mx-auto mt-6 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">{t.home.intro}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/profile" className={buttonVariants({ size: "lg" })}>
          {t.home.start}
        </Link>
        <Link href="/calculators" className={buttonVariants({ size: "lg", variant: "outline" })}>
          {t.home.tryCalc}
        </Link>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.home.noAccount}</p>
      <div className="mx-auto mt-12 max-w-2xl text-left">
        <div className="rounded-[22px] border border-border bg-card/70 p-2 shadow-[var(--shadow-card)] backdrop-blur">
          <div className="flex items-center gap-1.5 px-3 pb-2 pt-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="ml-3 rounded-full bg-muted px-3 py-0.5 text-[0.7rem] text-muted-foreground">taxgabay / calendar</span>
          </div>
          <SampleSchedule />
        </div>
      </div>
    </section>
  );
}

export function HomeFootnote() {
  const { t } = useLocale();
  return <>{t.home.footnote}</>;
}
