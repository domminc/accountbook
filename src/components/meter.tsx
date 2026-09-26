/**
 * 목표·예산 진행 막대. 채움 색이 상태를 나타내고, 색만으로 전하지 않도록 옆에 글자 표시를 함께 둔다.
 * - kind="limit" (지출·예산): 80% 이상 주의, 100% 초과 경고
 * - kind="target" (수입·저축 목표): 많을수록 좋음
 */
export function Meter({ value, max, kind, label }: { value: number; max: number; kind: "limit" | "target"; label: string }) {
  const ratio = max > 0 ? value / max : 0;
  const state = kind === "limit" ? (ratio > 1 ? "over" : ratio >= 0.8 ? "near" : "ok") : "ok";
  const fill = state === "over" ? "bg-danger" : state === "near" ? "bg-warning" : "bg-accent";
  const track = state === "over" ? "bg-danger/15" : state === "near" ? "bg-warning/15" : "bg-accent/15";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-2 w-full overflow-hidden rounded-full ${track}`}
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}

export function meterState(value: number, max: number): "ok" | "near" | "over" {
  const ratio = max > 0 ? value / max : 0;
  return ratio > 1 ? "over" : ratio >= 0.8 ? "near" : "ok";
}
