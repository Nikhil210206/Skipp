import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Caveat,
  Geist,
  Geist_Mono,
  Space_Grotesk,
  Unbounded,
} from "next/font/google";
import localFont from "next/font/local";
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

/**
 * The hand on the page. Headings, margin notes and doodled labels in the entry
 * notebook, and nothing else.
 *
 * **Deliberately never used for a number or for body copy.** A handwriting face
 * has no tabular figures, so an attendance percentage set in it would jitter as
 * it counts up, and long copy in it is measurably harder to read on a phone.
 * The notebook is a surface; what is written on it stays legible.
 */
const hand = Caveat({
  variable: "--font-hand-src",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// The entry screens only: sign-in and onboarding. Those screens are the pitch
// and get to have a voice, while the app itself stays in Geist, because a
// screen full of attendance figures wants a neutral face and dependable
// tabular numerals. Deliberately not wired to --font-sans.
const display = Bricolage_Grotesque({
  variable: "--font-display-src",
  subsets: ["latin"],
});

/**
 * Clay's puffy masthead title, and nothing else. `preload: false` IS LOAD
 * BEARING: the root layout preloads every font it declares, so without it every
 * student would download a face only a student on Clay ever uses.
 *
 * Fredoka, shipped in the repo rather than fetched from Google at build time.
 * On 2026-10-30 the production build on Vercel died resolving this one font
 * ("next/font/google queries have exactly one entry") with layout.tsx
 * unchanged since builds that passed, while every other Google font in this
 * file resolved and the same build passed on a laptop: whatever Google served
 * Vercel's builder for Fredoka, Turbopack could not parse it. A file in the
 * repo cannot change under us. It is the latin subset of the variable font
 * (OFL), so one file covers both weights Clay uses.
 */
const puffy = localFont({
  src: "./fonts/fredoka-latin.woff2",
  variable: "--font-puffy-src",
  weight: "600 700",
  display: "swap",
  preload: false,
});

/**
 * Ticket's display face: wide and loud on the big figures and headings. Body
 * copy and every column of figures stay in Geist, so nothing lines up
 * differently. `preload: false`, so only a student running Ticket fetches it.
 */
const ticketFace = Unbounded({
  variable: "--font-ticket-src",
  subsets: ["latin"],
  weight: ["600", "700"],
  preload: false,
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
  themeColor: "#000000",
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
      className={`${geistSans.variable} ${geistMono.variable} ${signature.variable} ${display.variable} ${hand.variable} ${puffy.variable} ${ticketFace.variable} h-full antialiased`}
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
