import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { isRole, canAccessRole, type Role } from "@/config/roles";
export async function currentProfile() {
  if (!supabaseConfig()) return null;
  const client = await supabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const result = await client
    .from("profiles")
    .select("id,full_name,role,active")
    .eq("id", user.id)
    .maybeSingle();
  if (result.error) throw new Error("Không thể xác minh hồ sơ người dùng.");
  if (!result.data || !result.data.active || !isRole(result.data.role))
    return null;
  return { ...result.data, role: result.data.role };
}
export async function requireRole(role: Role) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!canAccessRole(profile.role, role)) redirect("/unauthorized");
  return profile;
}
