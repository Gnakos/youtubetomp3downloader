/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/downloads/:path*",
        headers: [
          { key: "Content-Disposition", value: "attachment" },
        ],
      },
    ];
  },
};

export default nextConfig;