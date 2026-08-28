import type { NextConfig } from "next";

const config: NextConfig = {
  // Progress photos are served from Supabase Storage; nothing else is remote.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" }],
  },
};

export default config;
