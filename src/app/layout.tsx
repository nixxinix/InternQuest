import type { Metadata } from "next";
import { Inter, Silkscreen } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font: no request to Google at runtime, latin subset only.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${silkscreen.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
