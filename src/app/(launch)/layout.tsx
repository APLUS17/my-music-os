import type { Metadata, Viewport } from "next";
import "./launch.css";

// The launch page has its own root layout so its Apple-style tokens never touch the editor at `/`
// or the classic studio. Navigating from here into the app is a full page load.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://my-music-os.vercel.app"),
  title: "LYRIQ: Songs, not memos.",
  description:
    "Hum the idea, drop the beat, and watch your take turn into timed lyrics. LYRIQ is a free songwriting studio that runs in your browser.",
  openGraph: {
    title: "LYRIQ: Songs, not memos.",
    description: "Hum the idea. Drop the beat. Watch it turn into lyrics. Free in your browser.",
    images: [{ url: "/launch/og.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/launch/og.jpg"] },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function LaunchRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Apple devices render the system font (SF Pro). Inter is the substitute everywhere else. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="lx">{children}</body>
    </html>
  );
}
