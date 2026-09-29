import { describe, expect, it } from "vitest";
import { buildAssetLinks } from "./assetlinks";

const A = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");
const B = Array.from({ length: 32 }, () => "ab").join(":");

describe("buildAssetLinks", () => {
  it("패키지 이름과 지문으로 만든다 (여러 지문, 소문자·중복 정리)", () => {
    const links = buildAssetLinks(" kr.co.homesell.accountbook ", `${A},\n${B} ${A.toLowerCase()}`);
    expect(links).toHaveLength(1);
    expect(links[0].target).toEqual({
      namespace: "android_app",
      package_name: "kr.co.homesell.accountbook",
      sha256_cert_fingerprints: [A, B.toUpperCase()],
    });
    expect(links[0].relation).toContain("delegate_permission/common.handle_all_urls");
  });

  it("값이 없거나 잘못되면 빈 목록", () => {
    expect(buildAssetLinks(undefined, A)).toEqual([]);
    expect(buildAssetLinks("kr.co.homesell.accountbook", undefined)).toEqual([]);
    expect(buildAssetLinks("accountbook", A)).toEqual([]);
    expect(buildAssetLinks("kr.co.homesell.accountbook", "AB:CD")).toEqual([]);
  });
});
