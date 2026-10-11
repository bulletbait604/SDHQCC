/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      outputFileTracingIncludes: {
        '/api/streamdeck/download': ['./streamdeck-plugin/**/*'],
      },
    },
    images: {
      domains: [
        'kick.com',
        'images.kick.com',
        'files.kick.com',
        'static.kick.com',
        'stream.kick.com',
        'clips.kick.com',
        'iili.io',
      ],
    },
}

module.exports = nextConfig
