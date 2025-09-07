import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            { source: "/games", destination: "/api/games" },
            { source: "/games/search", destination: "/api/games/search" },
            { source: "/games/top-rated", destination: "/api/games/top-rated" },
            { source: "/games/:id", destination: "/api/games/:id" },
        ];
    },
};

export default nextConfig;
