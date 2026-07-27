import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import PWARegister from "@/components/PWARegister";

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
      className={`${geistSans.variable} ${geistMono.variable} ${signature.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
        <PWARegister />
      </body>
    </html>
  );
}
