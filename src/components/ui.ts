// 공통 모양 (루미너스 다크 벤토). 타일 16px, 버튼·입력 10~12px, 1px 발광 테두리, 누를 때 살짝 눌림.
const press = "transition duration-200 ease-snappy active:scale-[0.98] disabled:active:scale-100";

export const inputClass =
  "h-12 w-full rounded-xl border border-border bg-fill px-4 text-base outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/20";
export const smallInputClass =
  "h-10 w-full rounded-lg border border-border bg-fill px-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/20";
export const primaryButtonClass = `cta h-12 rounded-xl px-5 text-base font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110 disabled:opacity-50 ${press}`;
export const secondaryButtonClass = `tile h-12 rounded-xl px-5 text-base font-semibold hover:border-border-strong hover:brightness-125 disabled:opacity-50 ${press}`;
export const smallButtonClass = `tile h-10 shrink-0 rounded-lg px-3 text-sm font-medium hover:brightness-125 disabled:opacity-40 ${press}`;
export const cardClass = "tile card rounded-2xl";
/** 눌러서 들어가는 타일 (링크 카드): 올리면 테두리가 밝아지며 들린다 */
export const linkTileClass = "tile card tile-hover rounded-2xl";
/** 세그먼트 전환 (목록/달력, 지출/수입/저축 등): 어두운 틀 안에서 고른 칸만 떠 있다 */
export const segmentGroupClass = "grid rounded-xl border border-border bg-fill p-1";
export const segmentItemClass = (active: boolean) =>
  `flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
    active ? "bg-segment text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_3px_rgb(0_0_0/0.3)]" : "text-muted hover:text-foreground"
  }`;
/** 작은 라벨 (eyebrow) */
export const eyebrowClass = "eyebrow text-xs font-medium tracking-[0.04em] text-muted";
