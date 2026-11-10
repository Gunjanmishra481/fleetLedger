import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  serverExternalPackages: ["exceljs"],
  // The invoice builder reads the signature from disk; make sure Vercel ships it.
  outputFileTracingIncludes: { "/**": ["./src/assets/signature.jpeg"] },
};

export default nextConfig;
