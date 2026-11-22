export function PageHeader({ title, description, eyebrow }: { title: string; description?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="form-label mb-2">{eyebrow}</p>}
      <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">{title}</h1>
      <div className="mt-3 h-[3px] w-12 bg-ink" aria-hidden="true" />
      {description && <p className="mt-3 max-w-[68ch] text-[1.02rem] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
