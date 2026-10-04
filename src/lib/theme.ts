/** 화면 밝기. 기본은 다크 */
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
export const THEME_LABEL: Record<Theme, string> = { dark: "다크", light: "라이트", system: "기기 설정" };

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "dark";
}

/** 화면 디자인 (design-diversity 웹 팩). 기본은 루미너스 다크 벤토 */
export const DESIGNS = ["bento", "noir"] as const;
export type Design = (typeof DESIGNS)[number];
export const DESIGN_COOKIE = "design";
export const DESIGN_LABEL: Record<Design, string> = { bento: "루미너스 벤토", noir: "이리데센트 누아르" };
export const DESIGN_DESC: Record<Design, string> = {
  bento: "짙은 바탕에 빛나는 테두리 타일, 보라·자홍 글로우",
  noir: "잉크 블랙에 각진 카드, 테두리에만 흐르는 은빛 무지개",
};

export function parseDesign(value: string | undefined): Design {
  return DESIGNS.includes(value as Design) ? (value as Design) : "bento";
}
