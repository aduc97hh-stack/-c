import Link from "next/link";
import { CommandCenter } from "@/features/teaching/command-center";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/server/auth";
import { dashboardData } from "@/server/dashboard";
import { roleLabels, type Role } from "@/config/roles";
import { updateProfile } from "@/app/actions";

export async function Dashboard({ role }: { role: Role }) {
  const profile = await requireRole(role);
  const data = await dashboardData(role);

  return (
    <AppShell
      role={role}
      name={profile.full_name}
      title={role === "admin" ? "Tổng quan vận hành" : `Xin chào, ${profile.full_name}`}
      subtitle={
        role === "admin"
          ? "Nắm nhanh tình hình học tập, công việc cần xử lý và hoạt động trong ngày."
          : "Mọi việc cần làm hôm nay được gom về một nơi."
      }
    >
      {role === "admin" && <CommandCenter />}

      <section className="metric-grid" aria-label="Tổng quan">
        {role !== "media" && (
          <article className="metric-card">
            <div className="metric-icon soft-green">HS</div>
            <div>
              <span className="metric-value">{data.studentCount}</span>
              <p>Học sinh {role === "admin" ? "đang hoạt động" : "được phân công"}</p>
            </div>
          </article>
        )}
        {(role === "admin" || role === "teacher") && (
          <article className="metric-card">
            <div className="metric-icon soft-blue">L</div>
            <div>
              <span className="metric-value">{data.classCount}</span>
              <p>Lớp học</p>
            </div>
          </article>
        )}
        {role === "admin" && (
          <article className="metric-card">
            <div className="metric-icon soft-orange">NV</div>
            <div>
              <span className="metric-value">{data.users}</span>
              <p>Hồ sơ nhân sự</p>
            </div>
          </article>
        )}
      </section>

      <section className="dashboard-grid">
        {data.classes.length > 0 && (
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">LỚP HỌC</p>
                <h2>{role === "teacher" ? "Lớp của tôi" : "Lớp đang hoạt động"}</h2>
              </div>
              {role === "admin" && <Link className="text-link" href="/admin/schedules">Quản lý lịch →</Link>}
            </div>
            <div className="simple-list">
              {data.classes.map((c) => (
                <div className="simple-list-row" key={c.id}>
                  <span className="dot-indicator" />
                  <strong>{c.name}</strong>
                </div>
              ))}
            </div>
          </article>
        )}

        {role !== "media" && (
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">HỌC SINH</p>
                <h2>Trong phạm vi quyền</h2>
              </div>
              <span className="mini-count">{data.studentCount}</span>
            </div>
            {data.students.length ? (
              <div className="student-list">
                {data.students.map((s) => (
                  <Link className="student-row" href={`/students/${s.id}`} key={s.id}>
                    <span className="student-avatar">{s.full_name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{s.full_name}</strong>
                      <small>{s.student_code}</small>
                    </span>
                    <span className="row-arrow">→</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <strong>Chưa có học sinh</strong>
                <p>Thêm dữ liệu pilot để bắt đầu thử luồng vận hành.</p>
              </div>
            )}
          </article>
        )}
      </section>

      {role === "admin" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">NHÂN SỰ</p>
              <h2>Quản lý hồ sơ</h2>
            </div>
            <span className="mini-count">{data.profiles.length}</span>
          </div>
          <p className="muted">
            Tài khoản được tạo qua Supabase Auth; tại đây quản lý tên, vai trò và trạng thái sử dụng.
          </p>
          <div className="profile-grid">
            {data.profiles.map((p) => (
              <form className="profile-card" action={updateProfile} key={p.id}>
                <input type="hidden" name="id" value={p.id} />
                <div className="profile-card-head">
                  <div className="avatar large">{p.full_name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{p.full_name}</strong>
                    <span className="role-chip">{roleLabels[p.role]}</span>
                  </div>
                </div>
                <label>
                  Họ tên
                  <input
                    name="full_name"
                    defaultValue={p.full_name}
                    maxLength={120}
                    required
                    disabled={p.role === "admin"}
                  />
                </label>
                <label>
                  Vai trò
                  <select name="role" defaultValue={p.role} disabled={p.role === "admin"}>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="check-row">
                  <input type="checkbox" name="active" defaultChecked={p.active} disabled={p.role === "admin"} />
                  <span>Đang hoạt động</span>
                </label>
                <button disabled={p.role === "admin"}>Lưu hồ sơ</button>
              </form>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
