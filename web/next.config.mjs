import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep axios and dotenv server-side only — never bundled to the browser
  serverExternalPackages: ['axios', 'dotenv'],

  // Turbopack absolute workspace root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
