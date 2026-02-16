import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable gzip compression for responses
  compress: true,
  // Transpile xterm packages for proper CSS/ESM handling
  transpilePackages: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    '/': ['./src/**/*'],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns', 'lodash'],
  },
  staticPageGenerationTimeout: 120,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/npm/vscode-icons-js@*/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/vscode-icons/vscode-icons/**',
      },
    ],
  },
  // Add caching headers for static assets - helps tunnel performance
  // Only enable aggressive caching in production
  headers: async () => {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      return [
        {
          source: '/_next/static/:path*',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
          ],
        },
        {
          source: '/fonts/:path*',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
          ],
        },
      ];
    }

    // Development: disable cache
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Force single instance of @codemirror packages to avoid instanceof issues
    config.resolve.alias = {
      ...config.resolve.alias,
      '@codemirror/state': path.resolve(__dirname, 'node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, 'node_modules/@codemirror/view'),
      '@codemirror/language': path.resolve(__dirname, 'node_modules/@codemirror/language'),
    };

    // Externalize node-pty from server-side bundling (native addon)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('node-pty');
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
