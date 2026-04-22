import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute app root so Turbopack does not pick a parent folder when multiple lockfiles exist. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Allow LAN/mobile origins to request dev-only assets (HMR/client manifests).
   * Without this, phone sessions can stay "SSR-only" because Next blocks /_next dev endpoints.
   */
  allowedDevOrigins: ["10.0.0.210", "*.local"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
