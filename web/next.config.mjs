import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js not to bundle these Node.js-only modules into the client bundle
  serverExternalPackages: ['axios', 'dotenv'],

  // Set absolute root for Turbopack to avoid lockfile confusion in monorepo
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
