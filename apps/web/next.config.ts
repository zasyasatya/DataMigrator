import type { NextConfig } from "next";

const API = process.env.API_INTERNAL_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API}/api/v1/:path*` },
      { source: "/w/:path*", destination: `${API}/w/:path*` },
      { source: "/embed/:path*", destination: `${API}/embed/:path*` },
    ];
  },
};

export default nextConfig;
