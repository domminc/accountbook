import { dayTone } from "@/lib/holidays";

/** 달력 머리글 (일요일 시작) */
export const WEEKDAYS_SUN = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 요일 머리글 색: 일요일 빨강, 토요일 파랑 */
export function weekdayHeaderClass(index: number): string {
  return index === 0 ? "text-danger" : index === 6 ? "text-saturday" : "text-muted";
}

/** 날짜 숫자 색: 일요일·공휴일 빨강, 토요일 파랑 */
export function dayNumberClass(date: string): string {
  const tone = dayTone(date);
  return tone === "holiday" || tone === "sunday" ? "text-danger" : tone === "saturday" ? "text-saturday" : "";
}
