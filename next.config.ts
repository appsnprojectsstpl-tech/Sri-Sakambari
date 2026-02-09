
import type { NextConfig } from 'next';

const fs = require('fs');
const packageJson = require('./package.json');

// Read version code from build.gradle
let versionCode = 1;
try {
  const buildGradle = fs.readFileSync('./android/app/build.gradle', 'utf8');
  const match = buildGradle.match(/versionCode\s+(\d+)/);
  if (match) versionCode = parseInt(match[1]);
} catch (e) {
  console.warn('Could not read version code from build.gradle');
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_VERSION_CODE: versionCode.toString(),
  },
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'example.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ibb.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.themealdb.com', pathname: '/**' },
      { protocol: 'https', hostname: 'image2url.com', pathname: '/**' },
      { protocol: 'https', hostname: 'spoonacular.com', pathname: '/**' },
      { protocol: 'https', hostname: 'iibb.co', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.pixabay.com', pathname: '/**' },
      { protocol: 'https', hostname: 'pixabay.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'm.media-amazon.com', pathname: '/**' },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: false,
  generateBuildId: async () => 'build',
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
