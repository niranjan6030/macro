import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { TabBar } from "@/components/TabBar";
import { Frame, Grain } from "@/components/Cosmos";
import { ServiceWorker } from "@/components/InstallApp";
import { Scene } from "@/components/Scene";
import "./globals.css";

/* One family, across the whole app.
 *
 * There was a high-contrast serif italic on the headlines. It looked good in a
 * screenshot and read badly in use: the thin strokes disappeared against the
 * lit figure behind them, and italics at a glance, on a phone, in a gym, are
 * simply slower to read than upright text.
 *
 * Open Sans is the opposite trade — open apertures, a tall x-height, and it
 * holds up at small sizes and low contrast. Hierarchy comes from weight and
 * size instead of from a change of voice. Loaded through next/font so it is
 * self-hosted and there is no layout shift while a webfont arrives over gym
 * wifi. */
const sans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display-sans",
  display: "swap",
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
    <html lang="en" className={sans.variable}>
      <body>
        {/* The star, behind every screen. Nothing feeds it and nothing reads
            from it — it turns with the scrollbar and that is all it does. */}
        <Scene className="pointer-events-none fixed inset-0 -z-20" />
        <Grain />
        <Frame />
        <ServiceWorker />
        <AuthProvider>
          <main className="safe-top mx-auto w-full max-w-lg px-4">{children}</main>
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
