import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { GlassDefs } from "@/components/GlassDefs";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Xtrude",
  description: "Modeled time, measured from what you actually built.",
  applicationName: "Xtrude",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Xtrude",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Next's appleWebApp emits the modern tag; the legacy one is still what
    // older iOS reads to launch standalone from the home screen.
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // pinch-zoom stays available; never lock it to 1
  // lets the app paint into the notch and home-indicator areas, which the
  // safe-area-inset padding then clears
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlassDefs />
        <div className="app">{children}</div>
        <TabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
