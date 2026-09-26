import type { Field } from "@/lib/records";
import { AmountInput } from "@/components/amount-input";
import { smallInputClass } from "@/components/ui";

export type Option = { id: string; name: string };
export type OptionGroup = { label: string; options: Option[] };

type Values = Record<string, unknown>;

/** 항목 정의대로 입력 칸을 그린다 (추가·수정 폼 공용) */
export function RecordFields({
  fields,
  values = {},
  categories = [],
  paymentMethods = [],
  idPrefix,
}: {
  fields: Field[];
  values?: Values;
  categories?: OptionGroup[];
  paymentMethods?: Option[];
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const v = values[f.key];
        const str = v === null || v === undefined ? "" : String(v);
        const label = `${f.label}${f.required ? " *" : ""}`;
        const id = `${idPrefix}-${f.key}`;
        if (f.type === "bool") {
          return (
            <label key={f.key} className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name={f.key} defaultChecked={v === undefined ? true : Boolean(v)} className="h-5 w-5" />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.key} className={f.type === "longtext" ? "sm:col-span-2" : ""}>
            <label htmlFor={id} className="text-xs text-muted">
              {label}
            </label>
            {f.type === "amount" ? (
              <div className="mt-0.5">
                <AmountInput id={id} name={f.key} defaultValue={typeof v === "number" ? v : v ? Number(v) : null} className={smallInputClass} />
              </div>
            ) : f.type === "category" ? (
              <select id={id} name={f.key} defaultValue={str} className={`mt-0.5 ${smallInputClass}`}>
                <option value="">선택 안 함</option>
                {categories.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : f.type === "payment_method" ? (
              <select id={id} name={f.key} defaultValue={str} className={`mt-0.5 ${smallInputClass}`}>
                <option value="">선택 안 함</option>
                {paymentMethods.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.key}
                defaultValue={str}
                required={f.required}
                placeholder={f.placeholder}
                inputMode={f.type === "percent" ? "decimal" : f.type === "day" || f.type === "last4" ? "numeric" : undefined}
                maxLength={f.type === "last4" ? 4 : f.type === "longtext" ? 500 : 100}
                className={`mt-0.5 ${smallInputClass}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
