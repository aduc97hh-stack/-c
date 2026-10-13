"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="shell">
      <h1>Không thể tải dữ liệu</h1>
      <p>Vui lòng thử lại. Nếu lỗi tiếp tục, liên hệ quản trị viên.</p>
      <button onClick={reset}>Thử lại</button>
    </main>
  );
}
