import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { TabBar } from "@/components/TabBar";
import "./globals.css";

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
    <html lang="en">
      <body>
        <AuthProvider>
          <main className="mx-auto w-full max-w-lg px-4 safe-top">{children}</main>
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
