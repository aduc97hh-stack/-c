import { AppShell } from "@/components/app-shell";\nimport Link from "next/link";
import { requireStaff, checked, required } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { OperationForm } from "@/features/operations/form";
import { displayTime } from "@/features/teaching/model";
import {
  escalationLevel,
  durationSeconds,
  thresholdLabels,
} from "@/features/operations/model";
export default async function Page() {
  const profile = await requireStaff(["admin"]);
  const db = await supabaseServer();
  const [sum, conf, c, p, a, mode] = await Promise.all([
    db.rpc("operations_summary", {}),
    db.rpc("operations_configuration", {}),
    db.from("classes").select("id,name").eq("active", true),
    db
      .from("profiles")
      .select("id,full_name")
      .eq("role", "teacher")
      .eq("active", true),
    db.from("pilot_assignments").select("*"),
    db.from("pilot_config").select("*").single(),
  ]);
  const stats = required(sum),
    rules = required(conf),
    classes = checked(c) ?? [],
    teachers = checked(p) ?? [],
    assignments = checked(a) ?? [];
  const config = checked(mode);
  return (
    <AppShell role="admin" name={profile.full_name} active="operations" title="Vận hành hàng ngày" subtitle="Điều phối lịch, pilot, cảnh báo và các ngoại lệ cần quản trị.">
      <Link href="/admin">← Command Center</Link>
      <h1>Vận hành hàng ngày</h1>
      <nav>
        <Link href="/admin/schedules">Lịch lặp</Link>
        <Link href="/admin/corrections">Corrections ({stats.corrections})</Link>
        <Link href="/admin/audit">Audit</Link>
        <Link href="/notifications">
          Critical unread ({stats.critical_unread})
        </Link>
        <Link href="/admin/tasks">Công việc / ngoại lệ owner</Link>
      </nav>
      <section className="card">
        <h2>Chạy vận hành</h2>
        <p>
          Tạo lịch trong horizon và escalation. Có thể chạy lại; không
          duplicate. Scheduler hosted cần được cấu hình theo DEPLOYMENT.md.
        </p>
        <OperationForm command="run">
          <button>Chạy vận hành ngay</button>
        </OperationForm>
      </section>
      <section className="grid" aria-label="Pilot metrics">
        <article className="card">
          <h2>Pilot metrics · 7 ngày</h2>
          <p>Sessions pilot: {stats.pilot.sessions}</p>
          <p>
            Median checkout:{" "}
            {stats.pilot.median_seconds === null
              ? "Chưa có"
              : Math.round(stats.pilot.median_seconds) + " giây"}
          </p>
          <p>
            P90 checkout:{" "}
            {stats.pilot.p90_seconds === null
              ? "Chưa có"
              : Math.round(stats.pilot.p90_seconds) + " giây"}
          </p>
          <p>
            Average exceptions: {stats.pilot.average_exceptions ?? "Chưa có"} ·
            Save errors: {stats.pilot.save_errors}
          </p>
          <p>
            Mục tiêu median &lt;90 giây; chỉ dữ liệu đo thật mới chứng minh đạt
            mục tiêu.
          </p>
        </article>
        <article className="card">
          <h2>Pilot mode: {config?.pilot_mode ? "ON" : "OFF"}</h2>
          <ul>
            {assignments.map((a) => (
              <li key={a.teacher_id + a.class_id}>
                {classes.find((c) => c.id === a.class_id)?.name} ·{" "}
                {teachers.find((p) => p.id === a.teacher_id)?.full_name}
              </li>
            ))}
          </ul>
          <OperationForm command="pilot">
            <label>
              <input
                name="mode"
                type="checkbox"
                defaultChecked={config?.pilot_mode}
              />
              PILOT_MODE
            </label>
            <label>
              Lớp pilot
              <select name="class">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Giáo viên pilot
              <select name="teacher">
                {teachers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phân công
              <select name="enable">
                <option value="yes">Thêm pair</option>
                <option value="no">Gỡ pair</option>
              </select>
            </label>
            <button>Lưu pilot config</button>
          </OperationForm>
        </article>
      </section>
      <section className="card">
        <h2>Thresholds tập trung</h2>
        <OperationForm command="thresholds">
          {Object.entries(rules).map(([k, v]) => (
            <label key={k}>
              {thresholdLabels[k] ?? k}
              <input
                type="number"
                min={1}
                max={k === "horizon_days" ? 28 : 168}
                name={k}
                defaultValue={v}
                required
              />
            </label>
          ))}
          <button>Lưu thresholds</button>
        </OperationForm>
      </section>
      <h2>Hôm nay / chưa checkout</h2>
      {stats.sessions.map((s) => (
        <article className="card" key={s.id}>
          <Link href={"/teacher/sessions/" + s.id}>{s.title}</Link>
          <p>
            {s.status} · kết thúc {displayTime(s.ends_at)}
            {["scheduled", "in_progress"].includes(s.status) &&
              " · escalation: " +
                escalationLevel(
                  durationSeconds(s.ends_at, stats.as_of) / 3600,
                  rules.session_teacher_hours,
                  rules.session_admin_hours,
                )}
          </p>
        </article>
      ))}
    </AppShell>
  );
}
