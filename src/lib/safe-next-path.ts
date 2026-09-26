/**
 * 로그인 후 돌아갈 경로. 같은 사이트 안의 절대 경로만 허용해 외부 주소로 튕기는 것(open redirect)을 막는다.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  // "//evil.com", "/\evil.com" 은 브라우저가 다른 호스트로 해석한다
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // 제어 문자(탭·줄바꿈)는 브라우저가 지우고 해석하므로 거절
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
