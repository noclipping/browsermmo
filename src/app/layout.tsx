import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ClientHydrationProbe } from "@/components/client-hydration-probe";
import { SfxProvider } from "@/components/sfx-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Browser MMO Phase 1",
  description: "Next.js phase for a browser-first menu-based RPG",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <SfxProvider>
          <ClientHydrationProbe />
          {children}
        </SfxProvider>
      </body>
    </html>
  );
}
