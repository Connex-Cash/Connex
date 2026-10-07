import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next writes agent instruction files at the repo root unless this is off.
  // The public repository carries no Markdown but its README.
  agentRules: false,
  images: { unoptimized: true },
  // A second local build (end-to-end tests against a chain fork) goes to its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
