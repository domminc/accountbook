import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // id 는 설치한 앱을 알아보는 값이라 한 번 정하면 바꾸지 않는다
    id: "/",
    name: "가계부",
    short_name: "가계부",
    description: "부부가 함께 쓰는 가계부",
    lang: "ko",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    categories: ["finance", "productivity"],
    background_color: "#f2f4f6",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // 앱 아이콘을 길게 누르면 나오는 바로가기 (안드로이드 앱에도 그대로 들어간다)
    shortcuts: [
      { name: "거래 입력", short_name: "입력", url: "/transactions/new", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "거래 내역", short_name: "내역", url: "/transactions", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
