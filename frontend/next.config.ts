import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Prevent Next.js from walking up to a parent directory lockfile as workspace root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
