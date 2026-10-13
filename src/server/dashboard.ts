import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";
export async function dashboardData(role: Role) {
  const client = await supabaseServer();
  if (role === "media")
    return {
      students: [],
      classes: [],
      users: null,
      profiles: [],
      studentCount: 0,
      classCount: 0,
    };
  const [students, classes, users] = await Promise.all([
    client
      .from("students")
      .select("id,student_code,full_name,class_id", { count: "exact" })
      .eq("active", true)
      .order("student_code")
      .limit(100),
    role !== "cskh"
      ? client
          .from("classes")
          .select("id,name", { count: "exact" })
          .eq("active", true)
          .order("name")
      : Promise.resolve({ data: [], count: 0, error: null }),
    role === "admin"
      ? client
          .from("profiles")
          .select("id,full_name,role,active", { count: "exact" })
      : Promise.resolve({ data: [], count: null, error: null }),
  ]);
  if (students.error || classes.error || users.error)
    throw new Error("Không thể tải dashboard.");
  return {
    studentCount: students.count ?? 0,
    classCount: classes.count ?? 0,
    students: students.data ?? [],
    classes: classes.data ?? [],
    users: users.count,
    profiles: users.data ?? [],
  };
}
