import { defineConfig, devices } from "@playwright/test";

// 오프라인 테스트: 서비스 워커의 요청에도 setOffline 을 적용한다
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= "1";

// scripts/e2e.sh 가 임시 DB와 앱 서버를 띄운 뒤 E2E_BASE_URL 을 넘겨 실행한다
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    ...devices["iPhone 13"],
    browserName: "chromium",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
});
