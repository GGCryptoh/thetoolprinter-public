import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsentManager } from "@/components/system/consent-manager";
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
  title: "The Tool Printer — AI Tea | Your Daily AI Terminal",
  description: "Scored, curated AI intelligence. News, research, tools, and hot takes — signal over noise. thetoolprinter.com",
  icons: {
    icon: '/ai_tea_logo.png',
    apple: '/ai_tea_logo.png',
  },
  openGraph: {
    title: 'The Tool Printer — AI Tea',
    description: 'Scored, curated AI intelligence. News, research, tools, and hot takes — signal over noise.',
    siteName: 'The Tool Printer',
    images: [{ url: '/ai_tea_logo.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'The Tool Printer — AI Tea',
    description: 'Signal over noise. Scored AI news, curated by humans.',
    images: ['/ai_tea_logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ConsentManager />
      </body>
    </html>
  );
}
