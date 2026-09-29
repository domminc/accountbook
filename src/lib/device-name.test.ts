import { describe, expect, it } from "vitest";
import { deviceName } from "./device-name";

describe("deviceName", () => {
  it("흔한 기기를 알아본다", () => {
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPhone");
    expect(deviceName("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("iPad");
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36")).toBe(
      "Android 휴대폰",
    );
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/129.0 Safari/537.36")).toBe("Android 태블릿");
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("Mac");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0")).toBe("Windows PC");
  });

  it("모르면 '이 기기'", () => {
    expect(deviceName("")).toBe("이 기기");
    expect(deviceName(null)).toBe("이 기기");
  });
});
