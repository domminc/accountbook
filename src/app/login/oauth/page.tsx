import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginButtons } from "./login-buttons";
import { BrandMark } from "@/components/brand-mark";

export default async function LoginPage({ searchParams }: PageProps<"/login/oauth">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  if (await getUserId()) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="text-2xl font-bold tracking-tight">가계부</h1>
        <p className="mt-2 text-muted">부부가 함께 쓰는 가계부예요. 계정으로 로그인해 주세요.</p>

        {params.error ? (
          <p role="alert" className="mt-6 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
            로그인하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}

        <LoginButtons next={next} />
      </div>
    </main>
  );
}
