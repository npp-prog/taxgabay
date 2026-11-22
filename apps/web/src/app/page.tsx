import Link from "next/link";
import { HomeFootnote, HomeHero } from "@/components/home-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { href: "/profile", title: "Find out what applies to you", body: "Answer a few questions about your work or business. We list the registrations, returns and taxes that apply." },
  { href: "/calendar", title: "Never miss a deadline", body: "A tax calendar built from your profile, with weekend and holiday roll-over. Export to Google or Apple Calendar." },
  { href: "/checklists", title: "Stay compliant every month", body: "Monthly, quarterly and annual checklists from your profile, with a compliance score." },
  { href: "/calculators", title: "Compute with the legal basis shown", body: "Income tax (8% vs graduated), corporate, VAT, percentage, withholding, estate, donor's, capital gains, DST and penalties — every line explained." },
  { href: "/guides", title: "Step-by-step filing guides", body: "Who files, when, where, what to attach and common mistakes for the most-used BIR forms." },
  { href: "/roadmap", title: "Starting a business?", body: "Registration roadmaps for sole proprietorships (DTI), companies (SEC) and cooperatives (CDA), with progress saved." },
  { href: "/learn", title: "Learn the basics", body: "Plain-language articles, a Taglish-friendly glossary and answers to common questions." },
  { href: "/issuances", title: "BIR issuances, explained", body: "Revenue regulations, memorandum orders and circulars with plain-language summaries and links to the official text." },
  { href: "/life-events", title: "Big life events", body: "Hiring, closing a business, settling an estate, selling or donating property, moving RDO — step by step." },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <HomeHero />
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
          <HomeFootnote />
        </CardContent>
      </Card>
    </div>
  );
}
