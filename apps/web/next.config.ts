import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build directory lets the admin e2e build (with a mock Supabase URL) coexist with the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@taxgabay/tax-engine", "@taxgabay/content"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
