// 안드로이드 앱(Google Play 에 올린 TWA)이 이 사이트와 같은 주인임을 확인하는 /.well-known/assetlinks.json 내용.
// 확인되면 앱 위쪽에 주소창이 보이지 않고, 앱과 사이트가 로그인 정보(패스키)를 함께 쓴다.

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export type AssetLink = {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
};

/**
 * packageName: 앱 패키지 이름 (예: kr.co.homesell.accountbook)
 * fingerprints: 앱 서명 인증서 SHA-256 지문. 쉼표·공백·줄바꿈으로 여러 개 (업로드 키, Play 앱 서명 키)
 * 둘 중 하나라도 없으면 빈 목록.
 */
export function buildAssetLinks(packageName: string | undefined, fingerprints: string | undefined): AssetLink[] {
  const pkg = packageName?.trim() ?? "";
  if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(pkg)) return [];
  const prints = [
    ...new Set(
      (fingerprints ?? "")
        .split(/[\s,]+/)
        .map((f) => f.trim().toUpperCase())
        .filter((f) => FINGERPRINT.test(f)),
    ),
  ];
  if (prints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
    },
  ];
}
