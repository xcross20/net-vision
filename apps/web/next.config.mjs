import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, '..', '..'),
  // Button Presser token art is delivered as SVG either through our
  // own /api/media/token/[tokenId] route (server-generated) or via
  // OpenSea's seadn.io mirror (read-only public CDN). The SVG bodies
  // come from a closed set of trusted sources, so we can opt into
  // Next's SVG image optimization here.
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw2.seadn.io',
        pathname: '/robinhood/**',
      },
      {
        protocol: 'https',
        hostname: 'i.seadn.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'opensea.io',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: [
    '@net-vision/taxonomy',
    '@net-vision/chain-config',
    '@net-vision/opensea-client',
    '@net-vision/transaction-policy',
    '@net-vision/ui',
  ],
  // We import only `injected` and `walletConnect` from wagmi/connectors.
  // wagmi v2 still statically imports the Coinbase connector, which
  // transitively pulls @coinbase/cdp-sdk and a missing @x402/evm
  // module. Tell webpack not to bundle those.
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({
        '@coinbase/cdp-sdk': 'commonjs @coinbase/cdp-sdk',
        '@base-org/account': 'commonjs @base-org/account',
        '@x402/evm': 'commonjs @x402/evm',
      });
    }
    return config;
  },
};

export default nextConfig;
