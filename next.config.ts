import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://john-idea-6494f.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://john-idea-6494f.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
