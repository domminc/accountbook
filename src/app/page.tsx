import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getMembership } from "@/lib/household";

const KIND_LABEL = {
  income: "수입",
  saving: "저축",
  fixed_expense: "고정지출",
  variable_expense: "비고정지출",
} as const;

type GroupRow = {
  id: string;
  name: string;
  kind: keyof typeof KIND_LABEL;
  categories: { id: string; name: string; sort_order: number; is_hidden: boolean }[];
};

export default async function HomePage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const membership = await getMembership(supabase, userId);
  if (!membership) redirect("/onboarding");

  const [{ data: groups }, { data: methods }, { data: tags }] = await Promise.all([
    supabase
      .from("category_groups")
      .select("id, name, kind, categories(id, name, sort_order, is_hidden)")
      .eq("is_hidden", false)
      .order("sort_order")
      .returns<GroupRow[]>(),
    supabase.from("payment_methods").select("id, name").eq("is_hidden", false).order("sort_order"),
    supabase.from("tags").select("id, name").eq("is_hidden", false).order("sort_order"),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div>
          <h1 className="text-xl font-bold">{membership.householdName}</h1>
          <p className="text-sm text-muted">{membership.displayName}님</p>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface">
            로그아웃
          </button>
        </form>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">이달의 정리</h2>
        <p className="mt-1 text-sm text-muted">거래 입력과 월 대시보드는 다음 단계에서 열려요.</p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">카테고리</h2>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
          {(groups ?? []).map((g) => (
            <li key={g.id} className="px-5 py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-muted">{KIND_LABEL[g.kind]}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {g.categories
                  .filter((c) => !c.is_hidden)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((c) => c.name)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">지출방법</h2>
          <p className="mt-1 text-sm text-muted">{(methods ?? []).map((m) => m.name).join(" · ")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">태그</h2>
          <p className="mt-1 text-sm text-muted">{(tags ?? []).map((t) => t.name).join(" · ")}</p>
        </div>
      </section>
    </div>
  );
}
