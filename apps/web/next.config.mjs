import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, '..', '..'),
  transpilePackages: [
    '@net-vision/taxonomy',
    '@net-vision/chain-config',
    '@net-vision/opensea-client',
    '@net-vision/transaction-policy',
    '@net-vision/ui',
  ],
};

export default nextConfig;
