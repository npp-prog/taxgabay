import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { UserDataProvider } from "@/lib/user-data";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TaxGabay — Philippine BIR tax guide", template: "%s · TaxGabay" },
  description:
    "Tell us who you are, and we'll tell you what BIR expects from you, when, and how much. Personalized deadlines, calculators and filing guides for Philippine taxpayers.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b6e4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:p-2">
          Skip to content
        </a>
        <UserDataProvider>
          <SiteHeader />
          <main id="main" className="mx-auto max-w-5xl px-4 py-8">
            {children}
          </main>
        </UserDataProvider>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
            <p>TaxGabay explains and computes; it does not file for you. File on eBIRForms, eFPS or ORUS.</p>
            <Link href="/privacy" className="underline">
              Privacy notice
            </Link>
          </div>
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
