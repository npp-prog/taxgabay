import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build directory lets the admin e2e build (with a mock Supabase URL) coexist with the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@taxgabay/tax-engine", "@taxgabay/content", "@taxgabay/accounting", "@taxgabay/filing"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The site never uses the camera, microphone or location from page scripts (photo uploads use the file picker).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
