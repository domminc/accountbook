/** 화면 테마. 기본은 다크 (루미너스 다크 벤토) */
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
export const THEME_LABEL: Record<Theme, string> = { dark: "다크", light: "라이트", system: "기기 설정" };

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "dark";
}
