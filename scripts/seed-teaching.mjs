import { createClient } from "@supabase/supabase-js";
import { assertSeedTarget } from "./seed-safety.mjs";
assertSeedTarget(process.env);
if (process.env.GAMI_ALLOW_DEMO_SEED !== "yes")
  throw new Error("Dedicated demo project required");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const check = (r) => {
  if (r.error) throw new Error("Teaching seed failed: " + r.error.code);
  return r.data;
};
const profiles = check(await db.from("profiles").select("id,full_name,role"));
const teacher = profiles.find((p) => p.full_name === "Giáo viên 1"),
  cskh = profiles.find((p) => p.full_name === "CSKH 1"),
  other = profiles.find((p) => p.full_name === "CSKH 2"),
  admin = profiles.find((p) => p.role === "admin");
if (!teacher || !cskh || !other || !admin)
  throw new Error("Run Phase 1 demo seed first");
const classId = "21000000-0000-0000-0000-000000000001";
if (!check(await db.from("classes").select("id").eq("id", classId)).length) {
  check(
    await db
      .from("classes")
      .insert({ id: classId, name: "Checkout demo 15 HS" }),
  );
  check(
    await db
      .from("teacher_class_assignments")
      .insert({ class_id: classId, teacher_id: teacher.id }),
  );
  const students = Array.from({ length: 15 }, (_, i) => ({
    id: `31000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
    student_code: `P2-${String(i + 1).padStart(3, "0")}`,
    full_name: `Học sinh checkout ${i + 1}`,
    class_id: classId,
  }));
  check(await db.from("students").insert(students));
  check(
    await db
      .from("cskh_student_assignments")
      .insert(
        students
          .slice(0, 14)
          .map((s, i) => ({
            student_id: s.id,
            cskh_id: i === 13 ? other.id : cskh.id,
          })),
      ),
  );
}
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const id = "41000000-0000-0000-0000-000000000001";
if (!check(await db.from("class_sessions").select("id").eq("id", id)).length)
  check(
    await db
      .from("class_sessions")
      .insert({
        id,
        class_id: classId,
        teacher_id: teacher.id,
        starts_at: new Date(date + "T08:00:00+07:00").toISOString(),
        ends_at: new Date(date + "T09:30:00+07:00").toISOString(),
        lesson_title: "Unit 3 – My Friends",
        created_by: admin.id,
      }),
  );
console.info(
  "Teaching demo ready: 15 students, 1 daily session; existing data preserved.",
);
