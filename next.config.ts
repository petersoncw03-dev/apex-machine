import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.9'],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'https://api-blaze.193.111.116.40.sslip.io';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
