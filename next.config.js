/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['kick.com', 'images.kick.com'],
  },
}

module.exports = nextConfig
