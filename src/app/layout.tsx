import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetLedger",
  description: "Trip register and summaries for a car-carrier fleet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="font-sans">
      <body className="antialiased">{children}</body>
    </html>
  );
}
