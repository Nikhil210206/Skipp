import type { MetadataRoute } from "next";

// Web app manifest, which makes Skipp installable to the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skipp, know before you bunk",
    short_name: "Skipp",
    description:
      "Your SRM attendance, marks and timetable, minus the portal.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08080a",
    theme_color: "#08080a",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
