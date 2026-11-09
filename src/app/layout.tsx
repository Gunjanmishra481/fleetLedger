import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetLedger",
  description: "Log car-carrier trips in seconds and see profit by trailer, driver and route",
  applicationName: "FleetLedger",
  appleWebApp: { capable: true, title: "FleetLedger", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-180.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1a17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="font-sans">
      <body className="antialiased">{children}</body>
    </html>
  );
}
