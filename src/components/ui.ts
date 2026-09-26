// 공통 모양. 둥근 모서리, 부드러운 그림자, 누를 때 살짝 눌리는 효과.
const press = "transition active:scale-[0.98] disabled:active:scale-100";

export const inputClass =
  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15";
export const smallInputClass =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15";
export const primaryButtonClass = `h-12 rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground shadow-sm hover:brightness-110 disabled:opacity-50 ${press}`;
export const secondaryButtonClass = `h-12 rounded-2xl border border-border bg-surface px-5 text-base font-semibold hover:bg-fill disabled:opacity-50 ${press}`;
export const smallButtonClass = `h-10 shrink-0 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-fill disabled:opacity-40 ${press}`;
export const cardClass = "rounded-3xl bg-surface shadow-card";
/** 세그먼트 전환 (목록/달력, 지출/수입/저축 등): 회색 틀 안에서 고른 칸만 흰 바탕 */
export const segmentGroupClass = "grid rounded-2xl bg-fill p-1";
export const segmentItemClass = (active: boolean) =>
  `flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition ${
    active ? "bg-segment text-foreground shadow-sm" : "text-muted hover:text-foreground"
  }`;
