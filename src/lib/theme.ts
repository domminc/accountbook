/** 화면 밝기. 기본은 다크 */
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
export const THEME_LABEL: Record<Theme, string> = { dark: "다크", light: "라이트", system: "기기 설정" };

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "dark";
}

/** 화면 디자인 (design-diversity 웹 팩). 기본은 루미너스 다크 벤토 */
export const DESIGNS = ["bento", "fintech"] as const;
export type Design = (typeof DESIGNS)[number];
export const DESIGN_COOKIE = "design";
export const DESIGN_LABEL: Record<Design, string> = { bento: "루미너스 벤토", fintech: "정밀 핀테크" };
export const DESIGN_DESC: Record<Design, string> = {
  bento: "짙은 바탕에 빛나는 테두리 타일, 보라·자홍 글로우",
  fintech: "오프화이트에 잉크 네이비, 위쪽 파스텔 밴드, 또렷한 숫자 (밝기를 라이트로 하면 원래 모습)",
};

export function parseDesign(value: string | undefined): Design {
  return DESIGNS.includes(value as Design) ? (value as Design) : "bento";
}

/** 주소창·상태 표시줄 색 (디자인·밝기별) */
const BAR_COLOR: Record<Design, { dark: string; light: string }> = {
  bento: { dark: "#08080b", light: "#f4f4f7" },
  fintech: { dark: "#0c1220", light: "#f6f5f3" },
};

export function themeColor(design: Design, theme: Theme) {
  const c = BAR_COLOR[design];
  if (theme === "dark") return c.dark;
  if (theme === "light") return c.light;
  return [
    { media: "(prefers-color-scheme: light)", color: c.light },
    { media: "(prefers-color-scheme: dark)", color: c.dark },
  ];
}
