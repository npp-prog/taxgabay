import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SkipLink } from "@/components/skip-link";
import { UserDataProvider } from "@/lib/user-data";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TaxGabay — Philippine BIR tax guide", template: "%s · TaxGabay" },
  description:
    "Tell us who you are, and we'll tell you what BIR expects from you, when, and how much. Personalized deadlines, calculators and filing guides for Philippine taxpayers.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#1f3fa8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH">
      <body className="min-h-screen font-sans antialiased">
        <SkipLink />
        <UserDataProvider>
          <SiteHeader />
          <main id="main" className="mx-auto max-w-5xl px-4 py-8">
            {children}
          </main>
        </UserDataProvider>
        <SiteFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
