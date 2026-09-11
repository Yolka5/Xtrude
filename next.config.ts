import type { NextConfig } from "next";

/**
 * Phase 1 needs a server: API routes and DB reads at request time, so the
 * static `output: "export"` from Phase 0.5 is gone. Offline support doesn't
 * depend on that flag though - `public/sw.js` precaches its own route list
 * on install regardless of whether the HTML was generated statically or on
 * a server, so the PWA install/offline story is unaffected by this change.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  // Off so POST /api/webhooks/onshape is not 308'd (see src/proxy.ts).
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
