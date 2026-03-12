import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // 1. Enable WASM and Top-Level Await
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
      layers: true,
    };

    // 2. Fix for Node.js built-ins that Aztec might try to use
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  // 3. Tell Vercel to include the WASM file in the serverless bundle
  experimental: {
    outputFileTracingIncludes: {
      "/api/register": ["./node_modules/@aztec/bb.js/**/*.wasm"],
      "/api/faucet": ["./node_modules/@aztec/bb.js/**/*.wasm"],
    },
  },
  serverExternalPackages: ["@aztec/bb.js"],
};

export default nextConfig;
