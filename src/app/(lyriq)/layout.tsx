import type { Metadata, Viewport } from "next";
import "@/lyriq/index.css";

// The editor is a phone-first app: no pinch zoom, and it runs under the notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "LYRIQ" },
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
        {/* Cormorant Garamond (titles), Inter, Space Mono: the editor's own type system. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter+Tight:wght@500;600&family=Inter:wght@300;400;500;600&family=Noto+Sans+JP:wght@500;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ios-bg text-ios-text font-sans antialiased">{children}</body>
    </html>
  );
}
