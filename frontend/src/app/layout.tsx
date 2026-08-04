import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Geist,
  Geist_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import PWARegister from "@/components/PWARegister";
import Splash from "@/components/Splash";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used only for the maker's signature, so it reads as a mark rather than as
// part of the interface.
const signature = Space_Grotesk({
  variable: "--font-signature-src",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// The entry screens only: sign-in and onboarding. Those screens are the pitch
// and get to have a voice, while the app itself stays in Geist, because a
// screen full of attendance figures wants a neutral face and dependable
// tabular numerals. Deliberately not wired to --font-sans.
const display = Bricolage_Grotesque({
  variable: "--font-display-src",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skipp, know before you bunk",
  description:
    "Your SRM attendance, marks and timetable, minus the portal. Not affiliated with SRM.",
  applicationName: "Skipp",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Skipp",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${signature.variable} ${display.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
        {/* Above everything, and mounted here so it plays on a cold start only:
            a client navigation never remounts the root layout. */}
        <Splash />
        <PWARegister />
        {/* Page views only. It sees route names, and the routes carry no
            student data: no id, no marks, nothing identifying in a path. */}
        <Analytics />
        {/* Core Web Vitals from real devices. This is the honest answer to the
            transition lag that was reported from a phone and could never be
            reproduced here: INP is measured on the hardware people actually
            hold, not on a throttled desktop. It reports timings and route
            names, never anything about the student. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
