import type { Metadata, Viewport } from "next";
import "@/lyriq/index.css";

// Phone-first. Status bar is opaque black on the Home Screen app so the header can never sit under the clock;
// bars still pad by the safe-area insets (notch in landscape, home indicator at the bottom).
// Pinch zoom stays on for accessibility; inputs are 16px+ so iOS does not zoom on focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "LYRIQ",
  description: "Write lyrics, record vocal takes over your beat, and see them timed line by line.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "LYRIQ",
    description: "Write lyrics, record vocal takes over your beat, and see them timed line by line.",
  },
  appleWebApp: { capable: true, statusBarStyle: "black", title: "LYRIQ" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function LyriqRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Cormorant Garamond (titles) and Inter (body fallback). The service worker caches them for offline use. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ios-bg text-ios-text font-sans antialiased">{children}</body>
    </html>
  );
}
