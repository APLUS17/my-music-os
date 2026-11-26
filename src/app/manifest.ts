import type { MetadataRoute } from "next";

// Matches the editor at `/` (title, black background) so the home-screen app, splash and status bar agree.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LYRIQ",
    short_name: "LYRIQ",
    description: "Write lyrics, record vocal takes over your beat, and see them timed line by line.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["music", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed version with the glyph inside the safe zone, so Android's mask does not crop it.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
