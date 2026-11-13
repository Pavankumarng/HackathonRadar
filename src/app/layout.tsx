import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hackathon-radar-alpha.vercel.app"),
  title: "HackRadar — Find Every Hackathon in One Place",
  description: "Hackathon listings from Unstop and Devpost. Updated on a scheduled basis. No sign-up.",
  openGraph: {
    title: "HackRadar — Find Every Hackathon in One Place",
    description: "Hackathon listings updated on a scheduled basis. No sign-up.",
    url: "https://hackathon-radar-alpha.vercel.app",
    siteName: "HackRadar",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HackRadar — Find Every Hackathon in One Place",
    description: "Live hackathon listings updated every 12 hours. No sign-up.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary">
        <div className="tactical-grid-overlay" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
