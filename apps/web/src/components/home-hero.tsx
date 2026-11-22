"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

export function HomeHero() {
  const { t } = useLocale();
  return (
    <section className="space-y-4 py-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.home.title}</h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{t.home.intro}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/profile" className={buttonVariants({ size: "lg" })}>
          {t.home.start}
        </Link>
        <Link href="/calculators" className={buttonVariants({ size: "lg", variant: "outline" })}>
          {t.home.tryCalc}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{t.home.noAccount}</p>
    </section>
  );
}

export function HomeFootnote() {
  const { t } = useLocale();
  return <>{t.home.footnote}</>;
}
