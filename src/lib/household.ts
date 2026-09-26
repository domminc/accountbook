import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUserId } from "./auth";
import { withUser } from "./db";

export type Membership = {
  userId: string;
  householdId: string;
  householdName: string;
  displayName: string;
  role: "owner" | "member";
};

/** 사용자가 속한 가계부. 아직 없으면 null. */
export async function getMembership(userId: string): Promise<Membership | null> {
  const rows = await withUser(userId, (tx) => tx<
    { household_id: string; household_name: string; display_name: string; role: Membership["role"] }[]
  >`
    select m.household_id, h.name as household_name, m.display_name, m.role
    from public.members m
    join public.households h on h.id = m.household_id
    where m.user_id = ${userId}
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    userId,
    householdId: row.household_id,
    householdName: row.household_name,
    displayName: row.display_name,
    role: row.role,
  };
}

/** 로그인 + 가계부가 있어야 하는 화면·액션에서 쓴다. 한 요청 안에서는 한 번만 조회한다. */
export const requireHousehold = cache(async (): Promise<Membership> => {
  const userId = await requireUserId();
  const membership = await getMembership(userId);
  if (!membership) redirect("/onboarding");
  return membership;
});
