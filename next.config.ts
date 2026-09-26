import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 시트 가져오기: 1년치 거래를 JSON으로 보낸다 (원본 xlsx는 브라우저에서만 읽음)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
