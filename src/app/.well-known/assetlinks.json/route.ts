import { buildAssetLinks } from "@/lib/assetlinks";

// 안드로이드 앱 연결 확인 파일. 값은 Vercel 환경 변수 ANDROID_PACKAGE_NAME, ANDROID_SHA256_FINGERPRINTS (docs/DEPLOY.md)
export const dynamic = "force-dynamic";

export function GET() {
  const links = buildAssetLinks(process.env.ANDROID_PACKAGE_NAME, process.env.ANDROID_SHA256_FINGERPRINTS);
  return Response.json(links, { headers: { "Cache-Control": "public, max-age=300" } });
}
