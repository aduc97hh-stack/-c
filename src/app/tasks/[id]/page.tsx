import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, checked, required } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { changeTask } from "@/features/teaching/actions";
import { displayTime, statusLabels } from "@/features/teaching/model";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStaff(["admin", "cskh", "teacher"]);
  const db = await supabaseServer();
  const task = checked(
    await db
      .from("tasks")
      .select("*")
      .eq("id", (await params).id)
      .maybeSingle(),
  );
  if (!task) notFound();
  const student = checked(
    await db
      .from("students")
      .select("full_name")
      .eq("id", task.student_id)
      .single(),
  );
  const context = required(
    await db.rpc("student_context", { p_student: task.student_id }),
  );
  const events =
    checked(
      await db
        .from("student_events")
        .select("id,summary,created_at")
        .eq("student_id", task.student_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ) ?? [];
  const owners =
    profile.role === "admin"
      ? (checked(
          await db
            .from("profiles")
            .select("id,full_name,role")
            .eq("active", true),
        ) ?? [])
      : [];
  return (
    <main className="shell">
      <Link href={`/${profile.role}/tasks`}>← Việc hôm nay</Link>
      <h1>{task.title}</h1>
      <h2>
        <Link href={`/students/${task.student_id}`}>{student?.full_name}</Link>
      </h2>
      <p>
        {context.class_name} · {task.description}
      </p>
      <p>
        Owner:{" "}
        {task.owner_id
          ? profile.id === task.owner_id
            ? profile.full_name
            : (owners.find((p) => p.id === task.owner_id)?.full_name ??
              "Nhân sự được giao")
          : "Chưa phân công"}
      </p>
      <p>
        {displayTime(task.due_at)} · {task.priority} ·{" "}
        {statusLabels[task.status]}
      </p>
      <p>Nguồn session: {task.source_session_id ?? "Không có"}</p>
      <section className="card">
        <h2>Cập nhật công việc</h2>
        {["done", "cancelled"].includes(task.status) ? (
          <p>{task.result ?? "Công việc đã khóa"}</p>
        ) : (
          <form action={changeTask}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="version" value={task.version} />
            <label>
              Trạng thái
              <select name="status" defaultValue={task.status}>
                {Object.entries(statusLabels)
                  .filter(
                    ([v]) => v !== "cancelled" || profile.role === "admin",
                  )
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Kết quả (bắt buộc khi hoàn thành)
              <textarea
                name="result"
                maxLength={2000}
                defaultValue={task.result ?? ""}
              />
            </label>
            <label>
              Follow-up (UTC+7)
              <input type="datetime-local" name="follow_up" />
            </label>
            {profile.role === "admin" && (
              <label>
                Phân công owner
                <select name="owner" defaultValue="">
                  <option value="">Giữ nguyên</option>
                  {owners
                    .filter(
                      (p) =>
                        p.role ===
                        (task.type === "teacher_review" ? "teacher" : "cskh"),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button>Lưu công việc</button>
          </form>
        )}
      </section>
      <h2>Lịch sử liên quan</h2>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {displayTime(e.created_at)} · {e.summary}
          </li>
        ))}
      </ul>
      <p>Zalo OA: chưa tích hợp, không gửi tin tự động.</p>
    </main>
  );
}
