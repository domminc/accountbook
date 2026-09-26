import type { SupabaseClient } from "@supabase/supabase-js";

export type Membership = {
  householdId: string;
  householdName: string;
  displayName: string;
  role: "owner" | "member";
};

/** 사용자가 속한 가계부. 아직 없으면 null. RLS 때문에 본인 가구만 조회된다. */
export async function getMembership(supabase: SupabaseClient, userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from("members")
    .select("household_id, display_name, role, households(name)")
    .eq("user_id", userId)
    .maybeSingle<{
      household_id: string;
      display_name: string;
      role: Membership["role"];
      households: { name: string } | null;
    }>();

  if (error) throw error;
  if (!data) return null;
  return {
    householdId: data.household_id,
    householdName: data.households?.name ?? "",
    displayName: data.display_name,
    role: data.role,
  };
}
