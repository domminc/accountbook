import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  if (await getSessionUserId()) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">가계부</h1>
        <p className="mt-2 text-muted">부부가 함께 쓰는 가계부예요.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
