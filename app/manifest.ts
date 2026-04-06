import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Influo - Influencer Marketing Platform',
    short_name: 'Influo',
    description: 'Connect your talent with top brands. The most modern Influencer Marketing platform in Greece.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/favicon.svg',
        sizes: '32x32',
        type: 'image/svg+xml',
      },
      {
        src: '/logo-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/push-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/push-image-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
