import Link from "next/link";
export default function Unauthorized() {
  return (
    <main className="shell">
      <h1>Không có quyền truy cập</h1>
      <p>Vai trò của bạn không có quyền mở trang này.</p>
      <Link href="/">Về dashboard của tôi</Link>
    </main>
  );
}
