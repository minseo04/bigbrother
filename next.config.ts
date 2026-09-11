import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./drizzle/**/*'],
    '/s/**/*': ['./drizzle/**/*'],
  },
};

export default nextConfig;
