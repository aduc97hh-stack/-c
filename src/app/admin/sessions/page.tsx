import { AppShell } from "@/components/app-shell";\nimport Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { createSession } from "@/features/teaching/actions";
import { displayTime, schoolDate } from "@/features/teaching/model";
export default async function Page() {
  const profile = await requireStaff(["admin"]);
  const db = await supabaseServer();
  const [classes, teachers, sessions, assignments] = await Promise.all([
    db.from("classes").select("id,name").eq("active", true),
    db
      .from("profiles")
      .select("id,full_name")
      .eq("role", "teacher")
      .eq("active", true),
    db
      .from("class_sessions")
      .select("*")
      .order("starts_at", { ascending: false })
      .limit(100),
    db.from("teacher_class_assignments").select("*"),
  ]);
  return (
    <AppShell role="admin" name={profile.full_name} active="schedule" title="Buổi học" subtitle="Theo dõi trạng thái các buổi học và tiến độ checkout.">
      <Link href="/admin">← Command Center</Link>
      <h1>Lịch lớp</h1>
      <section className="card">
        <h2>Tạo buổi học</h2>
        <p>Chỉ chọn giáo viên được phân công lớp. Giờ theo UTC+7.</p>
        <ul>
          {checked(assignments)?.map((a) => (
            <li key={a.class_id + a.teacher_id}>
              {checked(classes)?.find((c) => c.id === a.class_id)?.name}:{" "}
              {checked(teachers)?.find((t) => t.id === a.teacher_id)?.full_name}
            </li>
          ))}
        </ul>
        <form action={createSession}>
          <label>
            Lớp
            <select name="class_id" required>
              {checked(classes)?.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giáo viên
            <select name="teacher_id" required>
              {checked(teachers)?.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày
            <input
              type="date"
              name="date"
              defaultValue={schoolDate()}
              required
            />
          </label>
          <label>
            Giờ bắt đầu
            <input type="time" name="start" defaultValue="17:30" required />
          </label>
          <label>
            Giờ kết thúc
            <input type="time" name="end" defaultValue="19:00" required />
          </label>
          <label>
            Bài dạy
            <input name="title" maxLength={200} required />
          </label>
          <button>Tạo session</button>
        </form>
      </section>
      {checked(sessions)?.map((s) => (
        <article className="card" key={s.id}>
          <Link href={`/teacher/sessions/${s.id}`}>{s.lesson_title}</Link>
          <p>
            {displayTime(s.starts_at)} · {s.status}
          </p>
        </article>
      ))}
    </AppShell>
  );
}
