import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    '/': ['./src/**/*'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
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
  webpack: (config) => {
    // Force single instance of @codemirror packages to avoid instanceof issues
    config.resolve.alias = {
      ...config.resolve.alias,
      '@codemirror/state': path.resolve(__dirname, 'node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, 'node_modules/@codemirror/view'),
      '@codemirror/language': path.resolve(__dirname, 'node_modules/@codemirror/language'),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
