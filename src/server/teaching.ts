import "server-only";
import { currentProfile } from "./auth";
import { redirect, notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";
export async function requireStaff(roles: Role[]) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!roles.includes(profile.role)) redirect("/unauthorized");
  return profile;
}
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("Không thể tải dữ liệu. Vui lòng thử lại.");
  return result.data;
}
export async function sessionData(id: string) {
  const profile = await requireStaff(["teacher", "admin"]);
  const db = await supabaseServer();
  const session = checked(
    await db.from("class_sessions").select("*").eq("id", id).maybeSingle(),
  );
  if (!session) notFound();
  const [records, students, attachments] = await Promise.all([
    db
      .from("effective_session_records")
      .select("*")
      .eq("session_id", id)
      .order("student_id"),
    db.rpc("session_roster", { p_session: id }),
    db.from("session_attachments").select("*").eq("session_id", id),
  ]);
  const effective = required(
    await db.rpc("session_effective_content", { p_session: id }),
  );
  const notes = effective.notes;
  const config = required(await db.rpc("teaching_configuration", {}));
  return {
    config,
    profile,
    session: {
      ...session,
      lesson_content: effective.lesson_content,
      homework_assigned: effective.homework_assigned,
    },
    records: checked(records) ?? [],
    students: checked(students) ?? [],
    notes,
    attachments: checked(attachments) ?? [],
  };
}

export function required<T>(result: {
  data: T;
  error: unknown;
}): NonNullable<T> {
  const data = checked(result);
  if (data === null || data === undefined)
    throw new Error("Không nhận được dữ liệu từ server.");
  return data;
}
