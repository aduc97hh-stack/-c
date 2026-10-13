"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { isRole } from "@/config/roles";
import { revalidatePath } from "next/cache";
import { requireRole, currentProfile } from "@/server/auth";
export async function login(form: FormData) {
  if (!supabaseConfig()) redirect("/login?error=config");
  const email = form.get("email"),
    password = form.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 1024
  )
    redirect("/login?error=invalid");
  const client = await supabaseServer();
  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) redirect("/login?error=invalid");
  const profile = await currentProfile();
  if (!profile) {
    const signedOut = await client.auth.signOut();
    if (signedOut.error)
      throw new Error("Không thể kết thúc phiên không hợp lệ.");
    redirect("/login?error=inactive");
  }
  redirect(`/${profile.role}`);
}
export async function logout() {
  const client = await supabaseServer();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Đăng xuất thất bại. Vui lòng thử lại.");
  redirect("/login");
}

export async function updateProfile(form: FormData) {
  await requireRole("admin");
  const id = form.get("id"),
    role = form.get("role"),
    full_name = form.get("full_name");
  if (
    typeof id !== "string" ||
    !/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(
      id,
    ) ||
    !isRole(role) ||
    typeof full_name !== "string" ||
    !full_name.trim() ||
    full_name.trim().length > 120
  )
    throw new Error("Thông tin hồ sơ không hợp lệ.");
  const client = await supabaseServer();
  const existing = await client
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();
  if (existing.error) throw new Error("Không tìm thấy hồ sơ.");
  // Administrator accounts are protected from accidental lockout in this UI.
  if (existing.data.role === "admin")
    throw new Error(
      "Thay đổi tài khoản quản trị cần quy trình quản trị riêng.",
    );
  const { data, error } = await client
    .from("profiles")
    .update({
      role,
      full_name: full_name.trim(),
      active: form.get("active") === "on",
    })
    .eq("id", id)
    .eq("role", existing.data.role)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Không thể cập nhật hồ sơ. Gỡ phân công trước khi đổi vai trò.",
    );
  revalidatePath("/admin");
}
