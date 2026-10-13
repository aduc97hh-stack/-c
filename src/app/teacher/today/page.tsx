import Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { todayBounds, displayTime } from "@/features/teaching/model";
export default async function Page() {
  const profile = await requireStaff(["teacher"]);
  const db = await supabaseServer();
  const [start, end] = todayBounds();
  const sessions =
    checked(
      await db
        .from("class_sessions")
        .select("*")
        .eq("teacher_id", profile.id)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at"),
    ) ?? [];
  const classes = checked(await db.from("classes").select("id,name")) ?? [];
  return (
    <main className="shell">
      <Link href="/teacher">← Dashboard</Link>
      <h1>Hôm nay</h1>
      <p>Lịch dạy theo giờ trung tâm (UTC+7).</p>
      {!sessions.length && <p>Không có lớp được giao hôm nay.</p>}
      {sessions.map((s) => (
        <article className="card" key={s.id}>
          <h2>
            {classes.find((c) => c.id === s.class_id)?.name} · {s.lesson_title}
          </h2>
          <p>
            {displayTime(s.starts_at)} — {displayTime(s.ends_at)}
          </p>
          <p>
            {s.status === "completed"
              ? "Đã hoàn thành"
              : s.status === "in_progress"
                ? "Đang dạy / draft"
                : s.status === "cancelled"
                  ? "Đã hủy"
                  : "Sắp dạy"}
          </p>
          {s.status !== "completed" &&
            s.status !== "cancelled" &&
            new Date(s.ends_at) < new Date() && (
              <p className="notice">Buổi học chưa được hoàn tất.</p>
            )}
          <Link className="button-link" href={`/teacher/sessions/${s.id}`}>
            {s.status === "completed"
              ? "Xem buổi đã hoàn thành"
              : s.status === "scheduled"
                ? "Mở / bắt đầu lớp"
                : "Kết thúc buổi học"}
          </Link>
        </article>
      ))}
    </main>
  );
}
