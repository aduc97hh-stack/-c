import Link from "next/link";
import { CommandCenter } from "@/features/teaching/command-center";
import { requireRole } from "@/server/auth";
import { dashboardData } from "@/server/dashboard";
import { roleLabels, type Role } from "@/config/roles";
import { logout, updateProfile } from "@/app/actions";
export async function Dashboard({ role }: { role: Role }) {
  const profile = await requireRole(role);
  const data = await dashboardData(role);
  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">GAMI OS · DAILY OPERATIONS</p>
          <span className="badge">{roleLabels[role]}</span>
        </div>
        <form action={logout}>
          <button>Đăng xuất</button>
        </form>
      </header>
      <h1>Xin chào, {profile.full_name}</h1>
      <nav>
        <Link href="/notifications">Thông báo</Link>
        {role === "admin" && <Link href="/admin/operations">Vận hành / Pilot</Link>}
        {role === "teacher" && (
          <>
            <Link href="/teacher/today">Hôm nay</Link>
            <Link href="/teacher/tasks">Việc kiểm tra lại bài</Link>
          </>
        )}
        {role === "cskh" && <Link href="/cskh/tasks">Mission Board</Link>}
      </nav>
      {role === "admin" && <CommandCenter />}
      <p>Dữ liệu hiển thị theo phân công và quyền truy cập của bạn.</p>
      <section className="grid" aria-label="Tổng quan">
        {role !== "media" && (
          <article className="card">
            <span className="metric">{data.studentCount}</span>Học sinh{" "}
            {role === "admin" ? "đang hoạt động" : "được phân công"}
          </article>
        )}
        {(role === "admin" || role === "teacher") && (
          <article className="card">
            <span className="metric">{data.classCount}</span>Lớp học
          </article>
        )}
        {role === "admin" && (
          <article className="card">
            <span className="metric">{data.users}</span>Hồ sơ nhân sự
          </article>
        )}
      </section>
      {data.classes.length > 0 && (
        <section className="card">
          <h2>{role === "teacher" ? "Lớp của tôi" : "Lớp học"}</h2>
          <ul>
            {data.classes.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </section>
      )}
      {role !== "media" && (
        <section className="card modules">
          <h2>Học sinh trong phạm vi quyền</h2>
          {data.studentCount > data.students.length && (
            <p>
              Đang hiển thị {data.students.length} trong {data.studentCount} học
              sinh. Danh sách chi tiết có phân trang sẽ được bổ sung ở module hồ
              sơ.
            </p>
          )}
          {data.students.length ? (
            <ul>
              {data.students.map((s) => (
                <li key={s.id}>
                  <Link href={`/students/${s.id}`}>
                    {s.student_code} · {s.full_name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có học sinh được phân công.</p>
          )}
        </section>
      )}
      {role === "admin" && (
        <section className="card modules">
          <h2>Quản lý hồ sơ nhân sự</h2>
          <p>
            Cấp tài khoản qua Supabase Auth; quản lý vai trò và trạng thái tại
            đây. Gỡ phân công trước khi đổi vai trò.
          </p>
          {data.profiles.map((p) => (
            <form className="profile-form" action={updateProfile} key={p.id}>
              <input type="hidden" name="id" value={p.id} />
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
                <select
                  name="role"
                  defaultValue={p.role}
                  disabled={p.role === "admin"}
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={p.active}
                  disabled={p.role === "admin"}
                />{" "}
                Đang hoạt động
              </label>
              <button disabled={p.role === "admin"}>Lưu hồ sơ</button>
            </form>
          ))}
        </section>
      )}
      <section className="card modules">
        <h2>
          {role === "admin"
            ? "Command Center & GAMI Pulse"
            : role === "teacher"
              ? "Lịch dạy & kết thúc buổi học"
              : role === "cskh"
                ? "Mission Board"
                : "Media Hub"}
        </h2>
        <p>
          {role === "media"
            ? "Media Hub được kích hoạt ở Phase 5. Hiện tại chưa có dữ liệu media và chưa có quyền đọc dữ liệu học sinh."
            : "Các nghiệp vụ buổi học, công việc và hồ sơ học sinh đã sẵn sàng qua các liên kết phía trên."}
        </p>
      </section>
    </main>
  );
}
