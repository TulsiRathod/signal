/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow loading avatar/attachment images served by the backend.
  images: { remotePatterns: [{ protocol: "http", hostname: "**" }] },
};

module.exports = nextConfig;
