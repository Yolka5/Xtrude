import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { AppChrome } from "@/components/AppChrome";
import { GlassDefs } from "@/components/GlassDefs";
import { PageTransition } from "@/components/PageTransition";
import { MotionProvider } from "@/components/MotionProvider";
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
    { media: "(prefers-color-scheme: light)", color: "#f6f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a08" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlassDefs />
        <MotionProvider>
          <AppChrome />
          <div className="app">
            <PageTransition>{children}</PageTransition>
          </div>
        {/* Scroll edges: content dissolves into the mesh before it reaches the
            chrome, with a progressive blur ramping toward each edge. This is
            what stops content ghosting through the glass. */}
        <div className="edge edge-top" aria-hidden="true" />
        <div className="edge edge-bottom" aria-hidden="true" />
        <div className="glow-bottom" aria-hidden="true" />
          <TabBar />
        </MotionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
