import Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { taskGroup, displayTime, statusLabels } from "./model";

const typeLabels: Record<string, string> = {
  homework_followup: "Bài tập",
  absence_followup: "Vắng học",
  low_score_followup: "Điểm thấp",
  teacher_review: "Giáo viên kiểm tra",
  general_attention: "Cần lưu ý",
};

const priorityLabels: Record<string, string> = {
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

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
  const studentIds = [...new Set(tasks.map((t) => t.student_id))];

  const [studentsResult, classesResult] = await Promise.all([
    studentIds.length
      ? db.from("students").select("id,full_name,class_id").in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    db.rpc("class_directory", {}),
  ]);

  const students = checked(studentsResult) ?? [];
  const classes = checked(classesResult) ?? [];

  const groups = [
    "Quá hạn",
    "Hôm nay",
    "Sắp tới",
    "Chờ phụ huynh",
    "Chờ giáo viên",
    "Đã hoàn thành",
  ];

  const counts = Object.fromEntries(
    groups.map((group) => [group, tasks.filter((t) => taskGroup(t) === group).length]),
  );

  return (
    <>
      <section className="task-stats">
        <article className="task-stat danger">
          <span>{counts["Quá hạn"]}</span>
          <p>Quá hạn</p>
        </article>
        <article className="task-stat today">
          <span>{counts["Hôm nay"]}</span>
          <p>Hôm nay</p>
        </article>
        <article className="task-stat waiting">
          <span>{counts["Chờ phụ huynh"]}</span>
          <p>Chờ phụ huynh</p>
        </article>
        <article className="task-stat priority">
          <span>{tasks.filter((t) => t.priority === "high" || t.priority === "urgent").length}</span>
          <p>Ưu tiên cao</p>
        </article>
      </section>

      <form className="filter-bar" method="GET">
        <div className="filter-field">
          <span>Loại việc</span>
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">Tất cả</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span>Ưu tiên</span>
          <select name="priority" defaultValue={filters.priority ?? ""}>
            <option value="">Tất cả</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span>Học sinh</span>
          <select name="student" defaultValue={filters.student ?? ""}>
            <option value="">Tất cả</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span>Lớp</span>
          <select name="class" defaultValue={filters.class ?? ""}>
            <option value="">Tất cả</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="filter-button">Lọc</button>
      </form>

      <div className="list-meta">
        <span>{tasksResult.count ?? 0} công việc</span>
        <span>Trang {page + 1}</span>
      </div>

      <div className="task-columns">
        {groups.map((group) => {
          const groupTasks = tasks.filter((t) => taskGroup(t) === group);
          return (
            <section className="task-group" key={group}>
              <div className="task-group-heading">
                <h2>{group}</h2>
                <span>{groupTasks.length}</span>
              </div>

              {groupTasks.length ? (
                <div className="task-card-list">
                  {groupTasks.map((t) => {
                    const student = students.find((s) => s.id === t.student_id);
                    const className = classes.find((c) => c.id === student?.class_id)?.name;
                    return (
                      <Link className="task-card" href={`/tasks/${t.id}`} key={t.id}>
                        <div className="task-card-top">
                          <span className={`priority-pill ${t.priority}`}>
                            {priorityLabels[t.priority] ?? t.priority}
                          </span>
                          <span className="task-time">{displayTime(t.due_at)}</span>
                        </div>
                        <h3>{student?.full_name ?? "Học sinh"}</h3>
                        <p className="task-title">{t.title}</p>
                        <p className="task-description">{t.description}</p>
                        <div className="task-card-footer">
                          <span>{className || "Chưa gán lớp"}</span>
                          <span>{statusLabels[t.status]}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-group">
                  <span>✓</span>
                  <p>Không có việc</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <nav className="pagination">
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
            ← Trang trước
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
            Trang sau →
          </Link>
        )}
      </nav>
    </>
  );
}
