import type { NextConfig } from "next";

/**
 * Hosts allowed to load the dev server cross-origin.
 *
 * Opening the dev server on a LAN address instead of localhost - to check the
 * store on a phone, say - is a cross-origin request, and Next rejects those by
 * default. The failure is badly disguised: the page still server-renders, so
 * the store looks finished, but the HMR socket never completes its handshake,
 * the client runtime never boots and hydration never happens. Every button is
 * inert, and nothing in the console points at the cart.
 *
 * The subnet wildcard is here because a DHCP lease renewal renumbers this
 * machine and would otherwise quietly break the page again. Set
 * NEXT_DEV_ORIGINS (comma-separated) for anything outside it.
 */
const devOrigins = [
  "192.168.68.111",
  "192.168.68.*",
  ...(process.env.NEXT_DEV_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
].filter(Boolean);

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: devOrigins,
  // Product artwork is served from /public, so there is no remote host to
  // allow. Add a remotePatterns entry here if the catalogue ever points at
  // images hosted somewhere else.
};

export default nextConfig;
