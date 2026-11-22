import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { href: "/profile", title: "Find out what applies to you", body: "Answer a few questions about your work or business. We list the registrations, returns and taxes that apply." },
  { href: "/calendar", title: "Never miss a deadline", body: "A tax calendar built from your profile, with weekend and holiday roll-over. Export to Google or Apple Calendar." },
  { href: "/checklists", title: "Stay compliant every month", body: "Monthly, quarterly and annual checklists from your profile, with a compliance score." },
  { href: "/calculators", title: "Compute with the legal basis shown", body: "Income tax (8% vs graduated), corporate, VAT, percentage, withholding, estate, donor's, capital gains, DST and penalties — every line explained." },
  { href: "/guides", title: "Step-by-step filing guides", body: "Who files, when, where, what to attach and common mistakes for the most-used BIR forms." },
  { href: "/roadmap", title: "Starting a business?", body: "Registration roadmaps for sole proprietorships (DTI), companies (SEC) and cooperatives (CDA), with progress saved." },
  { href: "/life-events", title: "Big life events", body: "Hiring, closing a business, settling an estate, selling or donating property, moving RDO — step by step." },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 py-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Tell us who you are, and we&apos;ll tell you what BIR expects from you — when, and how much.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          TaxGabay (<i>gabay</i> means &ldquo;guide&rdquo;) helps Philippine taxpayers understand their BIR obligations: what to register, file, pay and keep.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/profile" className={buttonVariants({ size: "lg" })}>
            Start my profile
          </Link>
          <Link href="/calculators" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Try a calculator
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">No account needed. Your answers stay in your browser unless you sign in.</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">
          TaxGabay explains and computes; it does not file on your behalf. All rates and deadlines are being verified by a CPA before launch.
          For guidance only — verify with BIR issuances or consult a CPA.
        </CardContent>
      </Card>
    </div>
  );
}
