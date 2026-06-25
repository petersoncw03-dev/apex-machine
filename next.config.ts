import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.9'],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'https://api-blaze.151.244.40.166.sslip.io';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
