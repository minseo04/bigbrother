import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./drizzle/**/*'],
    '/s/**/*': ['./drizzle/**/*'],
  },
  async redirects() {
    return [
      {source: '/signin-with-chatgpt', destination: '/', permanent: false},
      {source: '/signout-with-chatgpt', destination: '/api/auth/signout', permanent: false},
      {source: '/api/auth/local', destination: '/api/auth/google', permanent: false},
    ];
  },
};

export default nextConfig;
