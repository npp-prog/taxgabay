export function PageHeader({ title, description, eyebrow }: { title: string; description?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-10 pt-2">
      {eyebrow && <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-secondary-foreground">{eyebrow}</p>}
      <h1 className="font-display text-[2rem] font-semibold leading-[1.08] sm:text-[2.6rem]">{title}</h1>
      {description && <p className="mt-4 max-w-[64ch] text-[1.05rem] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
