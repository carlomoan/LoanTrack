/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false, // Use false for temporary redirects during development
      },
    ];
  },
};

module.exports = nextConfig;
