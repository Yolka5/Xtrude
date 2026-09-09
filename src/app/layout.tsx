import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { AppChrome } from "@/components/AppChrome";
import { GlassDefs } from "@/components/GlassDefs";
import { PageTransition } from "@/components/PageTransition";
import { MotionProvider } from "@/components/MotionProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { FONT_VARS } from "@/lib/fonts";

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
  // Light mode only, by design - see globals.css.
  themeColor: "#f2f2f5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables have to live on <html>, not <body>: globals.css's
    // `:root { --font: var(--font-nunito)... }` is evaluated for <html>, and
    // CSS custom properties only inherit downward - a variable set on a
    // descendant (<body>) is invisible to an ancestor's own declaration. Off
    // by one element, and the whole stack silently fell back to the
    // browser's serif default.
    <html lang="en" className={FONT_VARS}>
      <body>
        <GlassDefs />
        <MotionProvider>
          <AppChrome />
          <div className="app">
            <PageTransition>{children}</PageTransition>
          </div>
          {/* No scroll-edge fades needed anymore: the nav bar is solid once
              stuck (glass is tab-bar only now) and fully transparent before
              that, with nothing behind it to ghost through. */}
          <TabBar />
        </MotionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
