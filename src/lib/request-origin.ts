import { headers } from "next/headers";

/** 지금 요청이 들어온 사이트 주소 (예: https://www.homesell.co.kr). 초대 링크·패스키에 쓴다. */
export async function requestOrigin(): Promise<URL> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return new URL(`${proto}://${host}`);
}
