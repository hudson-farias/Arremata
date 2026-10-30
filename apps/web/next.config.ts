import type { NextConfig } from "next"

const apiURL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "")

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiURL}/:path*`,
      },
    ]
  },
}

export default nextConfig
