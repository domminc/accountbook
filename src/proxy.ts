import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// 로그인 없이 볼 수 있는 경로. /login/oauth 와 /auth/* 는 구글·카카오 로그인(보관 중)용.
// /api/sms 는 로그인 쿠키 대신 토큰으로 확인한다
const PUBLIC_PATHS = ["/login", "/signup", "/manifest.webmanifest", "/sw.js", "/api/sms", "/api/health"];
const PUBLIC_PREFIXES = ["/login/", "/auth/"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // 정적 파일과 이미지는 제외
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
