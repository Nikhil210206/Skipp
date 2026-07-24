import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Next doesn't get confused by a stray
  // lockfile in a parent directory (the "multiple lockfiles" dev warning).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
