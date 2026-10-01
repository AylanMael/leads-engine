import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Espace partenaire",
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return children;
}
