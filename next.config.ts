import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 시트 가져오기: 1년치 거래를 JSON으로 보낸다 (원본 xlsx는 브라우저에서만 읽음)
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        // 오프라인 입력용 서비스 워커: 배포하면 바로 새 버전을 받도록 캐시하지 않는다
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
