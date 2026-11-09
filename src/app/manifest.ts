import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FleetLedger",
    short_name: "FleetLedger",
    description: "Log car-carrier trips in seconds and see profit by trailer, driver and route.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8f6f1",
    theme_color: "#1f6f73",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "New trip", url: "/trips/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
