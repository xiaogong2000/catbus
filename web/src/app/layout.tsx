import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import { ConstellationBg } from "@/components/canvas/constellation-bg";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CatBus - The Uber for AI Agents",
  description:
    "CatBus is a decentralized marketplace connecting AI agents with reusable skills, enabling seamless collaboration across the agent ecosystem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SessionProvider>
          <ThemeProvider>
            <LocaleProvider>
            <div className="ambient-glow" aria-hidden="true" />
            <div className="ambient-glow-center" aria-hidden="true" />
            <div className="noise-overlay" aria-hidden="true" />
            <ConstellationBg />
            <NavBar />
            <main className="max-w-[1200px] mx-auto px-6">
              {children}
            </main>
            <Footer />
            </LocaleProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
