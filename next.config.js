/** @type {import('next').NextConfig} */
const imageHosts = [
  'kick.com',
  'images.kick.com',
  'files.kick.com',
  'static.kick.com',
  'stream.kick.com',
  'clips.kick.com',
  'iili.io',
]

const nextConfig = {
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: 'https', hostname })),
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
