import type { Metadata } from "next";
import Script from "next/script";
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
  title: "Foundzie – Lightning-fast personal concierge",
  description:
    "Foundzie helps you instantly discover nearby food, fun, trips and experiences with chat, voice concierge, and SOS support.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1020",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}

        {/* M12d: register a lightweight SW so install prompts work better */}
        <Script id="foundzie-sw" strategy="afterInteractive">
          {`
            (function() {
              try {
                if (!('serviceWorker' in navigator)) return;
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function(){});
                });
              } catch (e) {}
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
