import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nth Cup Kitchen',
    short_name: 'Nth Cup',
    start_url: '/admin/orders',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a1a2e',
    icons: [
      { src: '/icons/nth-cup-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/nth-cup-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/nth-cup-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}