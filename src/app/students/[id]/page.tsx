import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, checked, required } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { displayTime } from "@/features/teaching/model";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStaff(["admin", "teacher", "cskh"]);
  const id = (await params).id;
  const db = await supabaseServer();
  const student = checked(
    await db
      .from("students")
      .select("id,full_name,student_code")
      .eq("id", id)
      .maybeSingle(),
  );
  if (!student) notFound();
  const [contextResult, pulseResult, recordsResult, eventsResult] =
    await Promise.all([
      db.rpc("student_context", { p_student: id }),
      db.rpc("student_pulse", { p_student: id }),
      db
        .from("session_student_records")
        .select("*")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("student_events")
        .select("*")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  const context = required(contextResult),
    pulse = required(pulseResult),
    records = checked(recordsResult) ?? [],
    events = checked(eventsResult) ?? [];
  const sessions =
    checked(await db.rpc("student_session_history", { p_student: id })) ?? [];
  const recent = records.filter((r) =>
    sessions.some(
      (s) =>
        s.id === r.session_id &&
        s.status === "completed" &&
        new Date(s.starts_at).getTime() >= Date.now() - 30 * 86400000,
    ),
  );
  return (
    <main className="shell">
      <Link href={`/${profile.role}`}>← Dashboard</Link>
      <h1>Student 360 · {student.full_name}</h1>
      <p>
        {student.student_code} · {context.class_name}
      </p>
      <p>
        GV: {context.teachers?.join(", ") ?? "Chưa giao"} · CSKH:{" "}
        {context.cskh?.join(", ") ?? "Chưa giao"}
      </p>
      <section className={`pulse ${pulse.color}`}>
        <h2>
          GAMI Pulse:{" "}
          {pulse.color === "red"
            ? "ĐỎ"
            : pulse.color === "yellow"
              ? "VÀNG"
              : "XANH"}
        </h2>
        <ul>
          {pulse.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {!pulse.reasons.length && (
          <p>Không có cảnh báo gần đây hoặc công việc mở.</p>
        )}
      </section>
      <section className="grid">
        <article className="card">
          30 ngày: {recent.filter((r) => r.attendance === "present").length}/
          {recent.length} buổi có mặt
        </article>
        <article className="card">
          BTVN đủ: {recent.filter((r) => r.homework_status === "done").length} ·
          Thiếu: {recent.filter((r) => r.homework_status === "missing").length}
        </article>
        <article className="card">
          Cần lưu ý: {recent.filter((r) => r.needs_attention).length} · Điểm gần
          đây:{" "}
          {recent.find((r) => r.quick_score !== null)?.quick_score ?? "Chưa có"}
        </article>
      </section>
      <h2>Timeline</h2>
      {!events.length && <p>Chưa có dữ liệu học tập.</p>}
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {displayTime(e.created_at)} · {e.summary}
          </li>
        ))}
      </ul>
      <small>
        Hiển thị tối đa 50 sự kiện gần đây; tổng quan từ tối đa 200 records.
      </small>
    </main>
  );
}
