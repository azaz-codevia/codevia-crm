import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Excel imports are sent to the server in chunks; this leaves headroom.
      bodySizeLimit: "4mb",
    },
  },
  env: {
    NEXT_PUBLIC_APP_TIMEZONE: process.env.APP_TIMEZONE || "Asia/Riyadh",
  },
  poweredByHeader: false,
};

export default nextConfig;
