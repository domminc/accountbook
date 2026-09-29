import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { PasskeyLogin } from "./passkey-login";
import { ForgetDeletedUser } from "./forget-deleted-user";
import { BrandMark } from "@/components/brand-mark";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  if (await getSessionUserId()) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="text-2xl font-bold tracking-tight">가계부</h1>
        <p className="mt-2 text-muted">부부가 함께 쓰는 가계부예요.</p>
        {params.deleted ? (
          <p role="status" className="mt-6 rounded-lg border border-border px-3 py-2 text-sm">
            탈퇴했어요. 계정과 데이터를 지웠어요. 그동안 써 주셔서 고마워요.
            <ForgetDeletedUser />
          </p>
        ) : null}
        <PasskeyLogin next={next} />
        <LoginForm next={next} />
        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/privacy" className="underline underline-offset-4">
            개인정보처리방침
          </Link>
        </p>
      </div>
    </main>
  );
}
