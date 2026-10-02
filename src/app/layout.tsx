import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { getServerTenantConfig } from "../lib/tenant-server";
import { TenantProvider } from "../components/TenantProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getServerTenantConfig();
  return {
    title: tenant.vertical === "renovation" ? "Artisans Rénov | Devis de rénovation locaux" : "Comparateur Déménagement Local | Devis Vérifiés",
    description: tenant.labels.tagline,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const tenant = await getServerTenantConfig();
  return (
    <html lang="fr">
      <body className={`${inter.className} ${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <TenantProvider tenant={tenant}>{children}</TenantProvider>
      </body>
    </html>
  );
}
