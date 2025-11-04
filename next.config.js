/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove static export to enable API routes for Vercel
  // For static hosting, set output: 'export'
  // For Vercel with API routes, leave this out
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

