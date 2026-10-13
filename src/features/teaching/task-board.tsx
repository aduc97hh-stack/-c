import Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { taskGroup, displayTime, statusLabels } from "./model";
export async function TaskBoard({
  filters,
}: {
  filters: Record<string, string | undefined>;
}) {
  await requireStaff(["cskh", "admin", "teacher"]);
  const db = await supabaseServer();
  const page = Math.max(0, Math.min(10000, Number(filters.page) || 0));
  let query = db
    .from("tasks")
    .select("*", { count: "exact" })
    .order("due_at")
    .order("id")
    .range(page * 50, page * 50 + 49);
  if (filters.type) query = query.eq("type", filters.type as never);
  if (filters.priority) query = query.eq("priority", filters.priority as never);
  if (filters.student) query = query.eq("student_id", filters.student);
  if (filters.class) {
    const members =
      checked(
        await db.from("students").select("id").eq("class_id", filters.class),
      ) ?? [];
    query = query.in(
      "student_id",
      members.map((s) => s.id),
    );
  }
  const tasksResult = await query;
  const tasks = checked(tasksResult) ?? [];
  const [studentsResult, classesResult] = await Promise.all([
    db
      .from("students")
      .select("id,full_name,class_id")
      .in("id", [...new Set(tasks.map((t) => t.student_id))]),
    db.rpc("class_directory", {}),
  ]);
  const students = checked(studentsResult) ?? [],
    classes = checked(classesResult) ?? [];
  const groups = [
    "Quá hạn",
    "Hôm nay",
    "Sắp tới",
    "Chờ phụ huynh",
    "Chờ giáo viên",
    "Đã hoàn thành",
  ];
  return (
    <>
      <h1>Việc hôm nay</h1>
      <form className="card" method="GET">
        <label>
          Loại việc
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">Tất cả</option>
            {[
              "homework_followup",
              "absence_followup",
              "low_score_followup",
              "teacher_review",
              "general_attention",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Ưu tiên
          <select name="priority" defaultValue={filters.priority ?? ""}>
            <option value="">Tất cả</option>
            {["normal", "high", "urgent"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Học sinh
          <select name="student" defaultValue={filters.student ?? ""}>
            <option value="">Tất cả trong trang</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lớp
          <select name="class" defaultValue={filters.class ?? ""}>
            <option value="">Tất cả</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button>Lọc</button>
      </form>
      <p>
        {tasksResult.count ?? 0} công việc · trang {page + 1}, tối đa 50
        thẻ/trang.
      </p>
      {groups.map((group) => (
        <section key={group}>
          <h2>{group}</h2>
          {tasks
            .filter((t) => taskGroup(t) === group)
            .map((t) => {
              const student = students.find((s) => s.id === t.student_id);
              return (
                <article className="card" key={t.id}>
                  <h3>
                    <Link href={`/tasks/${t.id}`}>
                      {student?.full_name} · {t.title}
                    </Link>
                  </h3>
                  <p>
                    {classes.find((c) => c.id === student?.class_id)?.name} ·{" "}
                    {t.description}
                  </p>
                  <p>
                    {displayTime(t.due_at)} · {t.priority} ·{" "}
                    {statusLabels[t.status]}
                  </p>
                  <p>Nguồn: {t.source_session_id ? "Buổi học" : "Quản trị"}</p>
                </article>
              );
            })}
          {!tasks.some((t) => taskGroup(t) === group) && (
            <p>Không có việc trong nhóm trên trang này.</p>
          )}
        </section>
      ))}
      <nav>
        {page > 0 && (
          <Link
            href={
              "?" +
              new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(filters).filter(
                    (e): e is [string, string] => !!e[1],
                  ),
                ),
                page: String(page - 1),
              })
            }
          >
            Trang trước
          </Link>
        )}
        {(page + 1) * 50 < (tasksResult.count ?? 0) && (
          <Link
            href={
              "?" +
              new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(filters).filter(
                    (e): e is [string, string] => !!e[1],
                  ),
                ),
                page: String(page + 1),
              })
            }
          >
            Trang sau
          </Link>
        )}
      </nav>
    </>
  );
}
