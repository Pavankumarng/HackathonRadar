import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://hackradar.com"),
  title: "HackRadar — Find Every Hackathon in One Place",
  description: "Live hackathon listings from Unstop, Devfolio, HackerEarth, Devpost, Internshala, and HackCulture. Updated every 12 hours. No sign-up.",
  openGraph: {
    title: "HackRadar — Find Every Hackathon in One Place",
    description: "Live hackathon listings updated every 12 hours. No sign-up.",
    url: "https://hackradar.com",
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
      </body>
    </html>
  );
}
