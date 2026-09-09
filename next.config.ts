import type { NextConfig } from "next";

/**
 * Phase 0.5 is a static shell: no server, no API routes, no database.
 * `output: "export"` makes that structural rather than a promise - the build
 * emits plain HTML/CSS/JS, which is also what lets the service worker cache
 * every route reliably for offline use.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
