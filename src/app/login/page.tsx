import { login } from "@/app/actions";
import { supabaseConfig } from "@/lib/supabase/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = !!supabaseConfig();
  return (
    <main className="login">
      <section className="card">
        <p className="eyebrow">ANH NGỮ GAMI</p>
        <h1>Chào mừng đến GAMI OS</h1>
        <p>Một nơi làm việc chung, mỗi người đúng trách nhiệm.</p>
        {!configured && (
          <p role="status" className="notice">
            Chưa kết nối Supabase. Cần cấu hình URL và khóa public để đăng nhập.
            Không có chế độ bỏ qua xác thực.
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {error === "inactive"
              ? "Tài khoản chưa được cấp quyền hoặc đã bị khóa."
              : "Không thể đăng nhập. Kiểm tra thông tin và thử lại."}
          </p>
        )}
        <form action={login}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <button disabled={!configured}>Đăng nhập</button>
        </form>
        <small>Chỉ dành cho nhân sự được trung tâm cấp quyền.</small>
      </section>
    </main>
  );
}
