import { describe, expect, it } from "vitest";
import { detectImageType } from "./receipt";

describe("detectImageType", () => {
  it("앞 바이트로 형식을 판단한다", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("이미지가 아니면 null (확장자·Content-Type 은 믿지 않는다)", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
