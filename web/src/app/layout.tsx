import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Red_Hat_Display } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { TabBar } from "@/components/TabBar";
import { Frame, Grain } from "@/components/Cosmos";
import { Scene } from "@/components/Scene";
import "./globals.css";

/* One line per screen is set in the serif italic; everything functional is
   the sans. Loaded through next/font so they are self-hosted and there is no
   layout shift while a webfont arrives over gym wifi. */
const serif = Instrument_Serif({
  subsets: ["latin"], weight: "400", style: "italic",
  variable: "--font-display-serif", display: "swap",
});

const sans = Red_Hat_Display({
  subsets: ["latin"], weight: ["400", "500", "600", "700"],
  variable: "--font-display-sans", display: "swap",
});

export const metadata: Metadata = {
  title: "Macro — food, training, progress",
  description:
    "Log what you eat by photo, barcode or name, train to a plan that adapts to your last session, and watch the trend rather than the scale.",
  applicationName: "Macro",
  appleWebApp: { capable: true, title: "Macro", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#06080c",
  // The app is a single column by design; letting it zoom just breaks the
  // fixed tab bar.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {/* The default figure, behind every screen. The home screen mounts its
            own in place of this one, built from the signed-in person's body. */}
        <Scene className="pointer-events-none fixed inset-0 -z-20" />
        <Grain />
        <Frame />
        <AuthProvider>
          <main className="safe-top mx-auto w-full max-w-lg px-4">{children}</main>
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
