import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getSessionUserId()) redirect(next);
  return <SignupForm next={next} />;
}
