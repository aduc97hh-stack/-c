import { AppShell } from "@/components/app-shell";\nimport { TemplateSelector } from "@/features/operations/template-selector";
import Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { OperationForm } from "@/features/operations/form";
import { weekdayLabels } from "@/features/operations/model";
import { schoolDate, displayTime } from "@/features/teaching/model";
export default async function Page() {
  const profile = await requireStaff(["admin"]);
  const db = await supabaseServer();
  const [c, p, t, r, s] = await Promise.all([
    db.from("classes").select("id,name").eq("active", true),
    db
      .from("profiles")
      .select("id,full_name")
      .eq("role", "teacher")
      .eq("active", true),
    db
      .from("class_schedule_templates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("schedule_rules").select("*"),
    db
      .from("class_sessions")
      .select("*")
      .eq("status", "scheduled")
      .order("starts_at")
      .limit(100),
  ]);
  const classes = checked(c) ?? [],
    teachers = checked(p) ?? [],
    templates = checked(t) ?? [],
    rules = checked(r) ?? [],
    sessions = checked(s) ?? [];
  const today = schoolDate(),
    next = schoolDate(
      new Date(+new Date(today + "T00:00:00+07:00") + 14 * 86400000),
    );
  return (
    <AppShell role="admin" name={profile.full_name} active="schedule" title="Lịch dạy" subtitle="Quản lý lịch lặp, đổi giáo viên và các ngoại lệ theo từng buổi.">
      <Link href="/admin/operations">← Vận hành</Link>
      <h1>Lịch học lặp</h1>
      <section className="card">
        <h2>Tạo / thay đổi từ ngày X</h2>
        <p>
          UTC+7. Thay template chỉ hủy lịch chưa bắt đầu từ ngày chọn. Completed
          và roster đã bắt đầu được giữ.
        </p>
        <OperationForm command="schedule">
          <label>
            Lớp
            <select name="class">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giáo viên
            <select name="teacher">
              {teachers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày
            <input name="from" type="date" defaultValue={today} required />
          </label>
          <label>
            Đến ngày
            <input name="until" type="date" defaultValue={next} required />
          </label>
          <fieldset>
            <legend>Ngày trong tuần</legend>
            {weekdayLabels.map((l, i) => (
              <label key={i}>
                <input type="checkbox" name="weekday" value={i} />
                {l}
              </label>
            ))}
          </fieldset>
          <label>
            Bắt đầu
            <input type="time" name="start" defaultValue="17:30" required />
          </label>
          <label>
            Kết thúc
            <input type="time" name="end" defaultValue="19:00" required />
          </label>
          <TemplateSelector
            options={templates
              .filter((t) => t.active && t.ends_on >= today)
              .map((t) => ({
                id: t.id,
                version: t.version,
                label: `${classes.find((c) => c.id === t.class_id)?.name} · ${teachers.find((p) => p.id === t.teacher_id)?.full_name} · ${rules
                  .filter((r) => r.template_id === t.id)
                  .map(
                    (r) =>
                      weekdayLabels[r.weekday] +
                      " " +
                      r.starts_local.slice(0, 5),
                  )
                  .join(", ")} · ${t.starts_on}–${t.ends_on}`,
              }))}
          />
          <button>Lưu lịch lặp</button>
        </OperationForm>
      </section>
      {templates.map((t) => (
        <section key={t.id} className="card">
          <h2>
            {classes.find((c) => c.id === t.class_id)?.name} ·{" "}
            {teachers.find((p) => p.id === t.teacher_id)?.full_name}
          </h2>
          <p>
            {t.starts_on} — {t.ends_on} ·{" "}
            {t.active ? "Hoạt động" : "Đã thay thế"}
          </p>
          <ul>
            {rules
              .filter((r) => r.template_id === t.id)
              .map((r) => (
                <li key={r.weekday}>
                  {weekdayLabels[r.weekday]} {r.starts_local}–{r.ends_local}
                </li>
              ))}
          </ul>
          {t.active && (
            <OperationForm command="generate">
              <input type="hidden" name="template" value={t.id} />
              <label>
                Tạo từ
                <input type="date" name="from" defaultValue={today} required />
              </label>
              <label>
                Tạo đến
                <input type="date" name="until" defaultValue={next} required />
              </label>
              <button>Tạo sessions</button>
            </OperationForm>
          )}
        </section>
      ))}
      <h2>Nghỉ / đổi giáo viên một buổi</h2>
      {sessions.map((s) => (
        <section className="card" key={s.id}>
          <h3>
            {s.lesson_title} · {displayTime(s.starts_at)}
          </h3>
          <OperationForm command="exception">
            <input type="hidden" name="session" value={s.id} />
            <input type="hidden" name="version" value={s.version} />
            <label>
              Thao tác
              <select name="cancel">
                <option value="yes">Nghỉ buổi này</option>
                <option value="no">Đổi giáo viên</option>
              </select>
            </label>
            <label>
              Giáo viên thay
              <select name="teacher">
                {teachers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lý do
              <input name="reason" required minLength={5} maxLength={300} />
            </label>
            <button>Áp dụng ngoại lệ</button>
          </OperationForm>
        </section>
      ))}
      <p>
        Hiển thị tối đa 100 template/sessions. Generation tối đa 56 ngày mỗi
        lần.
      </p>
    </AppShell>
  );
}
