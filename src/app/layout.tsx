import type { Metadata, Viewport } from "next";
import { Inter, Silkscreen } from "next/font/google";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import "./globals.css";

// Self-hosted by next/font: no request to Google at runtime, latin subset only.
// "optional": on a slow first visit the text stays in the size-matched fallback
// font instead of swapping (and repainting) when the 84 KB Inter file lands
// late; later visits use the cached Inter. Cut the landing page's Largest
// Contentful Paint on slow mobile data (Phase 7 Lighthouse run).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "optional",
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "InternQuest: internships and OJT near you",
    template: "%s · InternQuest",
  },
  description: "Find internships and OJT near you that fit your skills, and track every application in one place.",
  applicationName: "InternQuest",
  appleWebApp: { capable: true, title: "InternQuest", statusBarStyle: "black" },
};

/** The browser bar matches the dark header (the bezel color) on phones. */
export const viewport: Viewport = {
  themeColor: "#16202a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${silkscreen.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
