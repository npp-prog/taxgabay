/** TaxGabay mark: a form with a folded corner and a check, in ink with a sun dot. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M7 3h13l6 6v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="var(--color-primary)" />
      <path d="M20 3v6h6" fill="none" stroke="var(--color-background)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 12.5h7M9.5 16.5h10" stroke="var(--color-primary-foreground)" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <path d="m10 22 3 3 6.5-6.5" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="24.5" r="3.5" fill="var(--color-sun)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.15rem] font-extrabold tracking-tight text-foreground">
        Tax<span className="text-primary">Gabay</span>
      </span>
    </span>
  );
}
