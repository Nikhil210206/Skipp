import type { Metadata, Viewport } from "next";
// EVERY FACE SHIPS IN THE REPO (src/app/fonts), none comes from Google at build
// time. `next/font/google` downloads each font while building, and when that
// download hiccups Turbopack fails the whole build with the unhelpful
// "next/font/google queries have exactly one entry". It killed production for Fredoka on
// 2026-10-30, for Unbounded after that, and for Space Grotesk on 2026-11-14 with
// the same code building fine on a laptop. A file in the repo cannot fail to
// download. Each is the latin subset Google serves (all OFL), and every one but
// Courier Prime is a variable font, so one file covers all its weights.
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import PWARegister from "@/components/PWARegister";
import Splash from "@/components/Splash";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
});

// Used only for the maker's signature, so it reads as a mark rather than as
// part of the interface.
const signature = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-signature-src",
  weight: "300 700",
  display: "swap",
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
const hand = localFont({
  src: "./fonts/caveat-latin.woff2",
  variable: "--font-hand-src",
  weight: "400 700",
  display: "swap",
});

// The entry screens only: sign-in and onboarding. Those screens are the pitch
// and get to have a voice, while the app itself stays in Geist, because a
// screen full of attendance figures wants a neutral face and dependable
// tabular numerals. Deliberately not wired to --font-sans.
const display = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-display-src",
  weight: "200 800",
  display: "swap",
});

/**
 * Clay's puffy masthead title, and nothing else. `preload: false` IS LOAD
 * BEARING: the root layout preloads every font it declares, so without it every
 * student would download a face only a student on Clay ever uses.
 *
 * Fredoka, the first face moved into the repo (see the note on the imports).
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
const ticketFace = localFont({
  src: "./fonts/unbounded-latin.woff2",
  variable: "--font-ticket-src",
  weight: "600 700",
  display: "swap",
  preload: false,
});

/**
 * Zine's print face: Archivo at its narrowest and heaviest, for the big
 * figures, the stamps and the masthead. The width axis is asked for because
 * the whole look is set at `font-stretch: 62%`. `preload: false`, so only a
 * student running Zine fetches it.
 *
 * **Not Anton, which is what the reference's headline looks like.** Measured:
 * Anton's "1" is a third narrower than its other digits and `tnum` changes
 * nothing, so a countdown set in it jitters on every tick. Archivo at 62%
 * reads almost the same and its figures are genuinely tabular.
 */
const zineFace = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-zine-src",
  weight: "100 900",
  // The width axis is what the look is set on, so the face has to declare it
  // or `font-stretch: 62%` would be ignored.
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  display: "swap",
  preload: false,
});

/** Zine's typed labels: "typed, then photocopied". Labels and meta only. */
const typedFace = localFont({
  src: [
    { path: "./fonts/courier-prime-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/courier-prime-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-typed-src",
  display: "swap",
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
      className={`${geistSans.variable} ${geistMono.variable} ${signature.variable} ${display.variable} ${hand.variable} ${puffy.variable} ${ticketFace.variable} ${zineFace.variable} ${typedFace.variable} h-full antialiased`}
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
